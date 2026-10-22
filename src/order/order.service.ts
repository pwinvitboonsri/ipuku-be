import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import {
  AuditAction,
  OrderChannel,
  Status,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreateOrderDTO } from './dto/create-order.dto.js';
import { VoidOrderDTO } from './dto/void-order.dto.js';
import { GetOrderListDTO } from './dto/get-order-list.dto.js';
import { GetByIdDTO } from './dto/get-by-id.dto.js';
import {
  buildOrderItem,
  productWithGroupsInclude,
} from './function/build-order-item.function.js';
import { orderInclude } from './function/order.include.js';
import { LoyaltyOrderService } from '../loyalty/loyalty-order.service.js';

// order_number collisions (two orders at once) are retried
const MAX_CREATE_ATTEMPTS = 3;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly loyalty: LoyaltyOrderService,
  ) {}

  async getList(dto: GetOrderListDTO) {
    let cashSessionId = dto.cash_session_id;

    if (!cashSessionId) {
      const session = await this.prisma.cashSession.findFirst({
        where: {
          close_at: null,
        },
      });

      if (!session) return [];

      cashSessionId = session.id;
    }

    return await this.prisma.order.findMany({
      where: {
        cash_session_id: cashSessionId,
        ...(dto.status && {
          status: dto.status,
        }),
        ...(dto.channel && {
          channel: dto.channel,
        }),
      },
      include: orderInclude,
      orderBy: {
        create_at: 'desc',
      },
    });
  }

  async getById(dto: GetByIdDTO) {
    return await this.prisma.order.findUniqueOrThrow({
      where: {
        id: dto.id,
      },
      include: orderInclude,
    });
  }

  async create(
    dto: CreateOrderDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
    // set by the Grab webhook; the POS endpoint always creates WALK_IN orders
    channel: OrderChannel = OrderChannel.WALK_IN,
  ) {
    for (let attempt = 1; ; attempt++) {
      try {
        const { order, created } = await this.createInTransaction(
          dto,
          actorStaffId,
          channel,
        );

        if (created) {
          await this.audit.log({
            staffId: actorStaffId,
            action: AuditAction.CREATE_ORDER,
            entityType: 'Order',
            entityId: order.id,
            metadata: {
              createData: {
                order_number: order.order_number,
                channel: order.channel,
                total_satang: order.total_satang,
                item_count: order.order_item.length,
              },
            },
            ipAddress: ip,
            userAgent: userAgent,
          });
        }

        return order;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // same client_order_id won a race: return that order
          const existing = await this.prisma.order.findUnique({
            where: { client_order_id: dto.client_order_id },
            include: orderInclude,
          });

          if (existing) return existing;

          // otherwise order_number collided: try again with the next number
          if (attempt < MAX_CREATE_ATTEMPTS) continue;
        }

        throw error;
      }
    }
  }

  private async createInTransaction(
    dto: CreateOrderDTO,
    actorStaffId: string,
    channel: OrderChannel,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: {
          client_order_id: dto.client_order_id,
        },
        include: orderInclude,
      });

      if (existing) return { order: existing, created: false };

      const session = await tx.cashSession.findFirst({
        where: {
          close_at: null,
        },
      });

      if (!session) {
        throw new BadRequestException('No open cash session');
      }

      const productIds = [...new Set(dto.items.map((i) => i.product_id))];
      const optionIds = [
        ...new Set(dto.items.flatMap((i) => i.modifier_option_ids)),
      ];

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          is_active: true,
        },
        include: productWithGroupsInclude,
      });

      const options = await tx.modifierOption.findMany({
        where: {
          id: { in: optionIds },
        },
      });

      const productsById = new Map(products.map((p) => [p.id, p]));
      const optionsById = new Map(options.map((o) => [o.id, o]));

      const items = dto.items.map((item) =>
        buildOrderItem(item, productsById.get(item.product_id), optionsById),
      );

      const subtotalSatang = items.reduce(
        (sum, item) => sum + item.line_total_satang,
        0,
      );
      // a reward code becomes a fixed discount worked out here, never by the POS
      const reward = dto.reward_code
        ? await this.loyalty.discountInTx(
            tx,
            dto.reward_code,
            // category and options let % off, free-option and buy-X-get-Y rewards find their lines
            items.map((i) => ({
              product_id: i.product_id,
              category_id: productsById.get(i.product_id)?.category_id ?? null,
              unit_price_satang: i.unit_price_satang,
              quantity: i.quantity,
              options: i.order_item_modifier.create.map((m) => ({ option_id: m.modifier_option_id, price_delta_satang: m.price_delta_satang })),
            })),
            subtotalSatang,
          )
        : null;
      const discountSatang = reward?.discountSatang ?? 0;

      const last = await tx.order.aggregate({
        where: {
          cash_session_id: session.id,
        },
        _max: {
          order_number: true,
        },
      });

      const order = await tx.order.create({
        data: {
          order_number: (last._max.order_number ?? 0) + 1,
          subtotal_satang: subtotalSatang,
          discount_satang: discountSatang,
          total_satang: subtotalSatang - discountSatang,
          channel,
          client_order_id: dto.client_order_id,
          cash_session_id: session.id,
          staff_id: actorStaffId,
          order_item: {
            create: items,
          },
        },
        include: orderInclude,
      });

      if (reward) {
        await this.loyalty.attachInTx(tx, reward.rewardCodeId, order.id, reward.discountSatang);
        const withReward = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
        return { order: withReward, created: true };
      }

      return { order, created: true };
    });
  }

  async void(
    dto: VoidOrderDTO,
    id: string,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: {
        id: id,
      },
    });

    if (order.status !== Status.OPEN) {
      throw new BadRequestException(
        `Only OPEN orders can be voided (current: ${order.status})`,
      );
    }

    // a reward on this order goes back to the customer's LINE screen
    const result = await this.prisma.$transaction(async (tx) => {
      await this.loyalty.releaseInTx(tx, id);
      return await tx.order.update({
        where: {
          id: id,
        },
        data: {
          status: Status.VOIDED,
        },
        include: orderInclude,
      });
    });

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.VOID_ORDER,
      entityType: 'Order',
      entityId: id,
      metadata: {
        reason: dto.reason,
        order_number: order.order_number,
        total_satang: order.total_satang,
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return result;
  }
}
