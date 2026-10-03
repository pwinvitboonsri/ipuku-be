import { describe, expect, it } from 'vitest';
import { productStock, type RecipeStockLine } from './product-stock.function.js';

const line = (name: string, per: number, stock: number, reorder: number, is_active = true): RecipeStockLine => ({
  quantity_per_unit: per,
  ingredient: { id: name.toLowerCase(), name, stock_quantity: stock, reorder_level: reorder, is_active },
});

describe('productStock', () => {
  it('is OK when every ingredient is above its reorder level', () => {
    expect(productStock([line('Milk', 18000, 500000, 200000), line('Espresso', 1800, 90000, 20000)])).toEqual({ status: 'OK', ingredients: [] });
  });

  it('is OK with no recipe', () => {
    expect(productStock([]).status).toBe('OK');
  });

  it('is LOW at or below the reorder level but still able to make one', () => {
    expect(productStock([line('Milk', 18000, 200000, 200000)])).toEqual({ status: 'LOW', ingredients: [{ id: 'milk', name: 'Milk', status: 'LOW' }] });
  });

  it('is OUT when stock cannot cover one unit, and OUT beats LOW', () => {
    const r = productStock([line('Milk', 18000, 150000, 200000), line('Espresso', 1800, 1000, 20000)]);
    expect(r.status).toBe('OUT');
    expect(r.ingredients.map((i) => [i.name, i.status])).toEqual([
      ['Espresso', 'OUT'],
      ['Milk', 'LOW'],
    ]);
  });

  it('skips inactive ingredients', () => {
    expect(productStock([line('Old syrup', 1000, 0, 500, false)]).status).toBe('OK');
  });
});
