import {
  HttpException,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { OrderService } from '../order/order.service.js';
import { PaymentService } from '../order/payment.service.js';
import { PushService } from '../push/push.service.js';
import { GrabClient } from './grab.client.js';
import {
  AuditAction,
  OrderChannel,
  PaymentType,
  Status,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { GrabSubmitOrderDTO } from './dto/grab-submit-order.dto.js';
import { GrabPushStateDTO } from './dto/grab-push-state.dto.js';
import {
  mapGrabOrder,
  summarizeItems,
} from './function/map-grab-order.function.js';

// Re-alert every minute, 5 times, until someone taps "Got it"
const REALERT_INTERVAL_MS = 60_000;
const REALERT_MAX = 5;

const baht = (satang: number) => `฿${(satang / 100).toFixed(2)}`;

type Caller = { ip: string; userAgent: string };

// Grab orders are auto-accepted: received -> created + paid (GRAB tender) in one go,
// through the same OrderService/PaymentService path as the counter. Anything the
// counter would refuse (no open shift, inactive product, bad options) is rejected.
@Injectable()
export class GrabOrderService implements OnModuleDestroy {
  private readonly logger = new Logger(GrabOrderService.name);
  // in-process re-alert timers; lost on restart (fine for now, see plan)
  private readonly realerts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
    private readonly paymentService: PaymentService,
    private readonly push: PushService,
    private readonly grab: GrabClient,
  ) {}

  onModuleDestroy() {
    this.realerts.forEach((t) => clearTimeout(t));
    this.realerts.clear();
  }

  private get systemStaffId() {
    return this.config.get<string>('grab.systemStaffId')!;
  }

  async receive(payload: GrabSubmitOrderDTO, caller: Caller) {
    // claim the Grab order id first: a retried or duplicated webhook hits the
    // unique constraint here and gets the first outcome back
    let grabOrder;
    try {
      grabOrder = await this.prisma.grabOrder.create({
        data: {
          grab_order_id: payload.orderID,
          short_order_number: payload.shortOrderNumber,
          merchant_id: payload.merchantID,
          state: 'RECEIVED',
          grab_subtotal_satang: payload.price.subtotal,
          raw_payload: payload as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.grabOrder.findUniqueOrThrow({
          where: { grab_order_id: payload.orderID },
        });
        return { duplicate: true, ...this.outcome(existing) };
      }
      throw error;
    }

    // AUTO: Grab already accepted on the merchant's behalf, nothing to send back
    const mustRespond = payload.featureFlags?.orderAcceptedType !== 'AUTO';

    let order;
    try {
      order = await this.createAndPay(payload, caller);
    } catch (error) {
      // anything else (DB down, bug) bubbles up as 500 so Grab retries;
      // the claimed row is released so the retry can run again
      if (!(error instanceof HttpException)) {
        await this.prisma.grabOrder.delete({ where: { id: grabOrder.id } });
        throw error;
      }
      return await this.reject(grabOrder.id, payload, error.message, mustRespond, caller);
    }

    const saved = await this.prisma.grabOrder.update({
      where: { id: grabOrder.id },
      data: { order_id: order.id, state: 'ACCEPTED' },
    });

    if (order.subtotal_satang !== payload.price.subtotal) {
      // Grab's menu prices drifted from ours: the order keeps our prices
      this.logger.warn(
        `Grab ${payload.shortOrderNumber}: Grab subtotal ${payload.price.subtotal} != ours ${order.subtotal_satang}. Re-sync the menu.`,
      );
    }

    if (mustRespond) {
      await this.safely('accept', () => this.grab.acceptOrder(payload.orderID));
    }

    await this.audit.log({
      staffId: this.systemStaffId,
      action: AuditAction.GRAB_ORDER_RECEIVED,
      entityType: 'Order',
      entityId: order.id,
      metadata: {
        grab_order_id: payload.orderID,
        short_order_number: payload.shortOrderNumber,
        grab_subtotal_satang: payload.price.subtotal,
        total_satang: order.total_satang,
      },
      ipAddress: caller.ip,
      userAgent: caller.userAgent,
    });

    const alert = {
      title: `🛵 GRAB ${payload.shortOrderNumber}`,
      body: `${summarizeItems(order.order_item)} · ${baht(order.total_satang)}`,
      tag: `grab-${saved.id}`,
      url: `/orders?highlight=${order.id}`,
      requireInteraction: true,
    };
    void this.push.sendToAll(alert);
    this.scheduleRealert(saved.id, alert, 1);

    return { duplicate: false, ...this.outcome(saved) };
  }

  private async createAndPay(payload: GrabSubmitOrderDTO, caller: Caller) {
    const items = mapGrabOrder(payload);

    const order = await this.orderService.create(
      { client_order_id: randomUUID(), items },
      this.systemStaffId,
      caller.ip,
      caller.userAgent,
      OrderChannel.GRAB,
    );

    try {
      const { order: paid } = await this.paymentService.pay(
        {
          payments: [
            { method: PaymentType.GRAB, amount_satang: order.total_satang },
          ],
        },
        order.id,
        this.systemStaffId,
        caller.ip,
        caller.userAgent,
      );
      return paid;
    } catch (error) {
      // never leave an OPEN Grab order behind: it would block closing the shift
      await this.orderService
        .void(
          { reason: 'Grab order could not be paid' },
          order.id,
          this.systemStaffId,
          caller.ip,
          caller.userAgent,
        )
        .catch((e) => this.logger.error(`Void after failed Grab pay: ${e}`));
      throw error;
    }
  }

  private async reject(
    grabOrderRowId: string,
    payload: GrabSubmitOrderDTO,
    reason: string,
    mustRespond: boolean,
    caller: Caller,
  ) {
    const saved = await this.prisma.grabOrder.update({
      where: { id: grabOrderRowId },
      data: { state: 'REJECTED', rejected_reason: reason },
    });

    if (mustRespond) {
      await this.safely('reject', () => this.grab.rejectOrder(payload.orderID));
    } else {
      // AUTO-accepted by Grab but we can't make it: needs a human on the Grab app
      this.logger.error(
        `Grab ${payload.shortOrderNumber} was auto-accepted by Grab but cannot be made here: ${reason}`,
      );
    }

    await this.audit.log({
      staffId: this.systemStaffId,
      action: AuditAction.GRAB_ORDER_REJECTED,
      entityType: 'GrabOrder',
      entityId: saved.id,
      metadata: {
        grab_order_id: payload.orderID,
        short_order_number: payload.shortOrderNumber,
        reason,
      },
      ipAddress: caller.ip,
      userAgent: caller.userAgent,
    });

    void this.push.sendToAll({
      title: `⚠️ GRAB ${payload.shortOrderNumber} ${mustRespond ? 'rejected' : 'needs attention'}`,
      body: reason,
      tag: `grab-${saved.id}`,
      url: '/orders',
      requireInteraction: true,
    });

    return { duplicate: false, ...this.outcome(saved) };
  }

  async updateState(dto: GrabPushStateDTO, caller: Caller) {
    const grabOrder = await this.prisma.grabOrder.findUnique({
      where: { grab_order_id: dto.orderID },
      include: { order: true },
    });

    // not ours (or never received): acknowledge so Grab stops retrying
    if (!grabOrder) {
      this.logger.warn(`State ${dto.state} for unknown Grab order ${dto.orderID}`);
      return { known: false };
    }

    await this.prisma.grabOrder.update({
      where: { id: grabOrder.id },
      data: { state: dto.state },
    });

    if (dto.state !== 'CANCELLED') return { known: true };

    this.stopRealert(grabOrder.id);

    if (grabOrder.order?.status === Status.PAID) {
      await this.safely('refund', () =>
        this.paymentService.refund(
          { reason: `Cancelled by Grab${dto.message ? `: ${dto.message}` : ''}` },
          grabOrder.order!.id,
          this.systemStaffId,
          caller.ip,
          caller.userAgent,
        ),
      );
    }

    await this.audit.log({
      staffId: this.systemStaffId,
      action: AuditAction.GRAB_ORDER_CANCELLED,
      entityType: 'GrabOrder',
      entityId: grabOrder.id,
      metadata: {
        grab_order_id: dto.orderID,
        short_order_number: grabOrder.short_order_number,
        message: dto.message ?? null,
      },
      ipAddress: caller.ip,
      userAgent: caller.userAgent,
    });

    void this.push.sendToAll({
      title: `❌ GRAB ${grabOrder.short_order_number} cancelled`,
      body: 'Cancelled by Grab, stop making it.',
      tag: `grab-${grabOrder.id}`,
      url: '/orders',
      requireInteraction: true,
    });

    return { known: true };
  }

  // "Got it" on the tablet or phone: stops the re-alerts
  async acknowledge(orderId: string, staffId: string, caller: Caller) {
    const grabOrder = await this.prisma.grabOrder.findUniqueOrThrow({
      where: { order_id: orderId },
    });

    this.stopRealert(grabOrder.id);

    if (grabOrder.acknowledged_at) return grabOrder;

    const saved = await this.prisma.grabOrder.update({
      where: { id: grabOrder.id },
      data: { acknowledged_at: new Date(), acknowledged_by_staff_id: staffId },
    });

    await this.audit.log({
      staffId,
      action: AuditAction.GRAB_ORDER_ACKNOWLEDGED,
      entityType: 'Order',
      entityId: orderId,
      metadata: { short_order_number: grabOrder.short_order_number },
      ipAddress: caller.ip,
      userAgent: caller.userAgent,
    });

    return saved;
  }

  async notifyMenuUpdate() {
    await this.grab.notifyMenuUpdate();
  }

  private scheduleRealert(
    grabOrderRowId: string,
    alert: Parameters<PushService['sendToAll']>[0],
    attempt: number,
  ) {
    if (attempt > REALERT_MAX) return;

    const timer = setTimeout(() => {
      this.realerts.delete(grabOrderRowId);
      void (async () => {
        const row = await this.prisma.grabOrder.findUnique({
          where: { id: grabOrderRowId },
          select: { acknowledged_at: true, state: true },
        });
        if (!row || row.acknowledged_at || row.state === 'CANCELLED') return;

        await this.push.sendToAll({
          ...alert,
          title: `${alert.title} (not seen yet)`,
        });
        this.scheduleRealert(grabOrderRowId, alert, attempt + 1);
      })().catch((e) => this.logger.warn(`Re-alert failed: ${e}`));
    }, REALERT_INTERVAL_MS);

    // don't keep the process alive just for an alert
    timer.unref();
    this.realerts.set(grabOrderRowId, timer);
  }

  private stopRealert(grabOrderRowId: string) {
    const timer = this.realerts.get(grabOrderRowId);
    if (timer) clearTimeout(timer);
    this.realerts.delete(grabOrderRowId);
  }

  // calls to Grab or follow-ups must not fail the webhook answer
  private async safely(what: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (error) {
      this.logger.error(`Grab ${what} failed: ${String(error)}`);
    }
  }

  private outcome(row: {
    order_id: string | null;
    state: string;
    rejected_reason: string | null;
  }) {
    return {
      accepted: row.order_id !== null,
      order_id: row.order_id,
      state: row.state,
      rejected_reason: row.rejected_reason,
    };
  }
}
