import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { productStock } from './function/product-stock.function.js';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // Everything the POS sell screen needs in one query: active rows only,
  // every level in display order. Each product also carries its stock status
  // (from its base recipe) so the counter can warn before selling.
  async getMenu() {
    const categories = await this.prisma.category.findMany({
      where: {
        is_active: true,
        product: { some: { is_active: true } },
      },
      orderBy: {
        sort_order: 'asc',
      },
      select: {
        id: true,
        name: true,
        sort_order: true,
        product: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            price_satang: true,
            image_url: true,
            recipe: {
              select: {
                quantity_per_unit: true,
                ingredient: {
                  select: {
                    id: true,
                    name: true,
                    stock_quantity: true,
                    reorder_level: true,
                    is_active: true,
                  },
                },
              },
            },
            modifier_group: {
              where: { modifier_group: { is_active: true } },
              orderBy: { sort_order: 'asc' },
              select: {
                sort_order: true,
                modifier_group: {
                  select: {
                    id: true,
                    name: true,
                    min_select: true,
                    max_select: true,
                    modifier_option: {
                      where: { is_active: true },
                      orderBy: { sort_order: 'asc' },
                      select: {
                        id: true,
                        name: true,
                        price_delta_satang: true,
                        sort_order: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // recipe stays server-side; the counter only needs the verdict
    return categories.map((c) => ({
      ...c,
      product: c.product.map(({ recipe, ...p }) => ({
        ...p,
        stock: productStock(recipe),
      })),
    }));
  }
}
