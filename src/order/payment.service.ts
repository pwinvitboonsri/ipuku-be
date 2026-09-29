import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { StockMovementService } from '../stock-movement/stock-movement.service.js';
import {
  AuditAction,
  PaymentType,
  Status,
} from '../generated/prisma/enums.js';
import { PayOrderDTO } from './dto/pay-order.dto.js';
import { RefundOrderDTO } from './dto/refund-order.dto.js';
import { orderInclude } from './function/order.include.js';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stockMovement: StockMovementService,
  ) {}

  async pay(
    dto: PayOrderDTO,
    orderId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const { order, payment } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: {
          order_item: true,
        },
      });

      const isCash = dto.method === PaymentType.CASH;

      if (isCash && dto.tender_satang! < order.total_satang) {
        throw new BadRequestException(
          `Tender ${dto.tender_satang} is less than total ${order.total_satang}`,
        );
      }

      // only one request can move OPEN -> PAID, so an order is never paid twice
      const { count } = await tx.order.updateMany({
        where: {
          id: orderId,
          status: Status.OPEN,
        },
        data: {
          status: Status.PAID,
          paid_at: new Date(),
        },
      });

      if (count === 0) {
        throw new BadRequestException(
          `Order is not OPEN (current: ${order.status})`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          order_id: orderId,
          method: dto.method,
          amount_satang: order.total_satang,
          tender_satang: isCash ? dto.tender_satang : null,
          change_satang: isCash ? dto.tender_satang! - order.total_satang : null,
          reference: dto.reference,
          marked_by_staff_id: actorStaffId,
        },
      });

      await this.stockMovement.deductForOrder(tx, order);

      const paidOrder = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: orderInclude,
      });

      return { order: paidOrder, payment };
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.PAY_ORDER,
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        method: payment.method,
        amount_satang: payment.amount_satang,
        tender_satang: payment.tender_satang,
        change_satang: payment.change_satang,
        reference: payment.reference,
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return order;
  }

  async refund(
    dto: RefundOrderDTO,
    orderId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const { order, refund } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: {
          cash_session: true,
          payment: true,
        },
      });

      if (order.status !== Status.PAID) {
        throw new BadRequestException(
          `Only PAID orders can be refunded (current: ${order.status})`,
        );
      }

      // the refund must come out of the same drawer that took the money
      if (order.cash_session.close_at !== null) {
        throw new BadRequestException(
          'Cash session already closed, refund must be handled manually',
        );
      }

      const { count } = await tx.order.updateMany({
        where: {
          id: orderId,
          status: Status.PAID,
        },
        data: {
          status: Status.REFUNDED,
        },
      });

      if (count === 0) {
        throw new BadRequestException('Order was already refunded');
      }

      const original = order.payment.find((p) => p.amount_satang > 0)!;

      // negative row: closeSession's cash sum drops automatically
      const refund = await tx.payment.create({
        data: {
          order_id: orderId,
          method: original.method,
          amount_satang: -original.amount_satang,
          marked_by_staff_id: actorStaffId,
        },
      });

      const refundedOrder = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: orderInclude,
      });

      return { order: refundedOrder, refund };
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.REFUND_ORDER,
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        reason: dto.reason,
        method: refund.method,
        amount_satang: refund.amount_satang,
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return order;
  }
}
