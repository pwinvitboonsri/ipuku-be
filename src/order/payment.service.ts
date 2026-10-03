import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { StockMovementService } from '../stock-movement/stock-movement.service.js';
import { AuditAction, Status } from '../generated/prisma/enums.js';
import { PayOrderDTO } from './dto/pay-order.dto.js';
import { RefundOrderDTO } from './dto/refund-order.dto.js';
import { orderInclude } from './function/order.include.js';
import { validateTenders } from './function/validate-tenders.function.js';

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
    const { order, payments, stockAlerts } = await this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUniqueOrThrow({
          where: {
            id: orderId,
          },
          include: {
            // options sold on each line drive the option-aware stock deduction
            order_item: { include: { order_item_modifier: true } },
          },
        });

        // throws before anything is written if the parts don't cover the total exactly
        const rows = validateTenders(order.total_satang, dto.payments);

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

        // one by one, so rows keep the tender order (orderInclude sorts by create_at)
        const payments = [];
        for (const row of rows) {
          payments.push(
            await tx.payment.create({
              data: {
                ...row,
                order_id: orderId,
                marked_by_staff_id: actorStaffId,
              },
            }),
          );
        }

        const stockAlerts = await this.stockMovement.deductForOrder(tx, order);

        const paidOrder = await tx.order.findUniqueOrThrow({
          where: {
            id: orderId,
          },
          include: orderInclude,
        });

        return { order: paidOrder, payments, stockAlerts };
      },
    );

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.PAY_ORDER,
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        payments: payments.map((p) => ({
          method: p.method,
          amount_satang: p.amount_satang,
          tender_satang: p.tender_satang,
          change_satang: p.change_satang,
          reference: p.reference,
        })),
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return { order, stockAlerts };
  }

  async refund(
    dto: RefundOrderDTO,
    orderId: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const { order, refunds } = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: {
          cash_session: true,
          payment: { orderBy: { create_at: 'asc' } },
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

      // one negative row per tender, same method: the cash part comes out of the
      // drawer (closeSession's cash sum drops), the PromptPay part is transferred back
      const refunds = [];
      for (const p of order.payment.filter((p) => p.amount_satang > 0)) {
        refunds.push(
          await tx.payment.create({
            data: {
              order_id: orderId,
              method: p.method,
              amount_satang: -p.amount_satang,
              marked_by_staff_id: actorStaffId,
            },
          }),
        );
      }

      const refundedOrder = await tx.order.findUniqueOrThrow({
        where: {
          id: orderId,
        },
        include: orderInclude,
      });

      return { order: refundedOrder, refunds };
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.REFUND_ORDER,
      entityType: 'Order',
      entityId: orderId,
      metadata: {
        reason: dto.reason,
        payments: refunds.map((r) => ({
          method: r.method,
          amount_satang: r.amount_satang,
        })),
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return order;
  }
}
