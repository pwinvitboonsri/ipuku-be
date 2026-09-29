import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import {
  AuditAction,
  StockMovementReason,
} from '../generated/prisma/enums.js';
import { Prisma } from '../generated/prisma/client.js';
import { AdjustStockDTO } from './dto/adjust-stock.dto.js';
import { GetStockMovementListDTO } from './dto/get-stock-movement-list.dto.js';

const ingredientSelect = {
  id: true,
  name: true,
  unit: true,
};

@Injectable()
export class StockMovementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(dto: GetStockMovementListDTO) {
    return await this.prisma.stockMovement.findMany({
      where: {
        ...(dto.ingredient_id && {
          ingredient_id: dto.ingredient_id,
        }),

        ...(dto.reason && {
          reason: dto.reason,
        }),

        ...((dto.after || dto.before) && {
          create_at: {
            ...(dto.after && { gte: dto.after }),
            ...(dto.before && { lte: dto.before }),
          },
        }),
      },
      include: {
        ingredient: { select: ingredientSelect },
      },
      orderBy: {
        create_at: 'desc',
      },
    });
  }

  // Runs inside the payment transaction. Stock may go negative:
  // a sale is never blocked at the counter.
  async deductForOrder(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      order_item: { product_id: string; quantity: number }[];
    },
  ) {
    const productIds = [...new Set(order.order_item.map((i) => i.product_id))];

    const recipes = await tx.recipe.findMany({
      where: {
        product_id: { in: productIds },
      },
    });

    const totalByIngredient = new Map<string, number>();

    for (const item of order.order_item) {
      for (const recipe of recipes) {
        if (recipe.product_id !== item.product_id) continue;

        totalByIngredient.set(
          recipe.ingredient_id,
          (totalByIngredient.get(recipe.ingredient_id) ?? 0) +
            recipe.quantity_per_unit * item.quantity,
        );
      }
    }

    for (const [ingredientId, total] of totalByIngredient) {
      await tx.stockMovement.create({
        data: {
          ingredient_id: ingredientId,
          order_id: order.id,
          change_quantity: -total,
          reason: StockMovementReason.SALE,
        },
      });

      await tx.ingredient.update({
        where: {
          id: ingredientId,
        },
        data: {
          stock_quantity: { decrement: total },
        },
      });
    }
  }

  async adjust(
    dto: AdjustStockDTO,
    actorStaffId: string,
    ip: string,
    userAgent: string,
  ) {
    if (dto.reason === StockMovementReason.RESTOCK && dto.change_quantity < 0) {
      throw new BadRequestException('RESTOCK must add stock (positive)');
    }

    if (dto.reason === StockMovementReason.WASTE && dto.change_quantity > 0) {
      throw new BadRequestException('WASTE must remove stock (negative)');
    }

    const { movement, before, after } = await this.prisma.$transaction(
      async (tx) => {
        const ingredient = await tx.ingredient.findUniqueOrThrow({
          where: {
            id: dto.ingredient_id,
          },
        });

        const updated = await tx.ingredient.update({
          where: {
            id: ingredient.id,
          },
          data: {
            stock_quantity: { increment: dto.change_quantity },
          },
        });

        const movement = await tx.stockMovement.create({
          data: {
            ingredient_id: ingredient.id,
            change_quantity: dto.change_quantity,
            reason: dto.reason,
            note: dto.note,
          },
          include: {
            ingredient: { select: ingredientSelect },
          },
        });

        return {
          movement,
          before: ingredient.stock_quantity,
          after: updated.stock_quantity,
        };
      },
    );

    await this.audit.log({
      staffId: actorStaffId,
      action: AuditAction.STOCK_ADJUSTMENT,
      entityType: 'Ingredient',
      entityId: dto.ingredient_id,
      metadata: {
        reason: dto.reason,
        change_quantity: dto.change_quantity,
        note: dto.note ?? null,
        before: { stock_quantity: before },
        after: { stock_quantity: after },
      },
      ipAddress: ip,
      userAgent: userAgent,
    });

    return movement;
  }
}
