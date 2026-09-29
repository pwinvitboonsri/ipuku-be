import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { AuditAction, Status } from '../generated/prisma/enums.js';
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

// order_number collisions (two orders at once) are retried
const MAX_CREATE_ATTEMPTS = 3;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
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
  ) {
    for (let attempt = 1; ; attempt++) {
      try {
        const { order, created } = await this.createInTransaction(
          dto,
          actorStaffId,
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

  private async createInTransaction(dto: CreateOrderDTO, actorStaffId: string) {
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
      const discountSatang = 0;

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
          client_order_id: dto.client_order_id,
          cash_session_id: session.id,
          staff_id: actorStaffId,
          order_item: {
            create: items,
          },
        },
        include: orderInclude,
      });

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

    const result = await this.prisma.order.update({
      where: {
        id: id,
      },
      data: {
        status: Status.VOIDED,
      },
      include: orderInclude,
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
