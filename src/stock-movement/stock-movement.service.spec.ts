import { describe, expect, it, vi } from 'vitest';
import { StockMovementService } from './stock-movement.service.js';

// deductForOrder against an in-memory transaction: checks the wiring from the
// order's option snapshot to one SALE movement per ingredient.
function fakeTx(base: object[], mods: object[]) {
  const movements: { ingredient_id: string; change_quantity: number; order_id: string; reason: string }[] = [];
  const decrements: Record<string, number> = {};
  const tx = {
    recipe: { findMany: vi.fn(async ({ where }: any) => base.filter((r: any) => where.product_id.in.includes(r.product_id))) },
    recipeModifier: {
      findMany: vi.fn(async ({ where }: any) =>
        mods.filter((r: any) => where.product_id.in.includes(r.product_id) && where.modifier_option_id.in.includes(r.modifier_option_id)),
      ),
    },
    stockMovement: { create: vi.fn(async ({ data }: any) => movements.push(data)) },
    ingredient: {
      update: vi.fn(async ({ where, data }: any) => {
        decrements[where.id] = (decrements[where.id] ?? 0) + data.stock_quantity.decrement;
      }),
    },
  };
  return { tx, movements, decrements };
}

describe('StockMovementService.deductForOrder', () => {
  it('deducts base + selected options, summed per ingredient across the order (plan example)', async () => {
    const base = [
      { product_id: 'latte', ingredient_id: 'whole', quantity_per_unit: 18000 },
      { product_id: 'latte', ingredient_id: 'ice', quantity_per_unit: 15000 },
      { product_id: 'tea', ingredient_id: 'concentrate', quantity_per_unit: 10000 },
      { product_id: 'tea', ingredient_id: 'ice', quantity_per_unit: 15000 },
    ];
    const mods = [
      { product_id: 'latte', modifier_option_id: 'L', ingredient_id: 'whole', quantity_delta: 10000 },
      { product_id: 'latte', modifier_option_id: 'L', ingredient_id: 'ice', quantity_delta: 10000 },
      { product_id: 'latte', modifier_option_id: 'oat', ingredient_id: 'whole', quantity_delta: -18000 },
      { product_id: 'latte', modifier_option_id: 'oat', ingredient_id: 'oat', quantity_delta: 18000 },
      { product_id: 'tea', modifier_option_id: 'L', ingredient_id: 'concentrate', quantity_delta: 5000 },
      { product_id: 'tea', modifier_option_id: 'L', ingredient_id: 'ice', quantity_delta: 10000 },
    ];
    const { tx, movements, decrements } = fakeTx(base, mods);
    const service = new StockMovementService({} as any, {} as any);

    await service.deductForOrder(tx as any, {
      id: 'order-1',
      order_item: [
        { product_id: 'latte', quantity: 2, order_item_modifier: [{ modifier_option_id: 'L' }, { modifier_option_id: 'oat' }] },
        { product_id: 'tea', quantity: 1, order_item_modifier: [{ modifier_option_id: 'L' }] },
      ],
    });

    // exactly one movement per ingredient for the order
    expect(movements.map((m) => m.ingredient_id).sort()).toEqual(['concentrate', 'ice', 'oat', 'whole']);
    expect(movements.every((m) => m.order_id === 'order-1' && m.reason === 'SALE')).toBe(true);
    expect(decrements).toEqual({
      whole: 20000, // 2 × (180 + 100 − 180) ml
      oat: 36000, // 2 × 180 ml
      ice: 75000, // latte 2 × 250 + tea 250 g
      concentrate: 15000, // 100 + 50 ml
    });
    expect(Object.fromEntries(movements.map((m) => [m.ingredient_id, m.change_quantity]))).toEqual({
      whole: -20000,
      oat: -36000,
      ice: -75000,
      concentrate: -15000,
    });
  });

  it('skips the option query when nothing was customised', async () => {
    const { tx, decrements } = fakeTx([{ product_id: 'cookie', ingredient_id: 'flour', quantity_per_unit: 5000 }], []);
    const service = new StockMovementService({} as any, {} as any);
    await service.deductForOrder(tx as any, { id: 'o', order_item: [{ product_id: 'cookie', quantity: 3, order_item_modifier: [] }] });
    expect(tx.recipeModifier.findMany).not.toHaveBeenCalled();
    expect(decrements).toEqual({ flour: 15000 });
  });
});
