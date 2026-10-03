import { describe, expect, it } from 'vitest';
import { stockAlertsAfterSale, type DeductedIngredient } from './stock-alerts.function.js';

// Quantities in hundredths (1 L of milk in ml -> 100000)
const milk = (stock: number, used: number, over: Partial<DeductedIngredient> = {}): DeductedIngredient => ({
  id: 'milk',
  name: 'Whole milk',
  unit: 'ml',
  is_active: true,
  reorder_level: 200000, // 2 L
  stock_quantity: stock,
  used,
  ...over,
});

describe('stockAlertsAfterSale', () => {
  it('alerts when a sale crosses the reorder level', () => {
    expect(stockAlertsAfterSale([milk(190000, 18000)])).toEqual([
      { ingredient_id: 'milk', name: 'Whole milk', unit: 'ml', stock_quantity: 190000, reorder_level: 200000, status: 'LOW' },
    ]);
  });

  it('alerts on exactly reaching the reorder level', () => {
    expect(stockAlertsAfterSale([milk(200000, 18000)]).map((a) => a.status)).toEqual(['LOW']);
  });

  it('stays quiet while already low, and above the line', () => {
    expect(stockAlertsAfterSale([milk(150000, 18000)])).toEqual([]);
    expect(stockAlertsAfterSale([milk(500000, 18000)])).toEqual([]);
  });

  it('alerts OUT when stock reaches zero or below, even if it was already low', () => {
    expect(stockAlertsAfterSale([milk(0, 18000)])[0].status).toBe('OUT');
    expect(stockAlertsAfterSale([milk(-6000, 18000)])[0]).toMatchObject({ status: 'OUT', stock_quantity: -6000 });
    // already at/below zero before the sale: no repeat
    expect(stockAlertsAfterSale([milk(-24000, 18000)])).toEqual([]);
  });

  it('treats a jump from fine to empty as OUT', () => {
    expect(stockAlertsAfterSale([milk(-1000, 300000)])[0].status).toBe('OUT');
  });

  it('ignores inactive ingredients and lists OUT first, then by name', () => {
    const r = stockAlertsAfterSale([
      milk(190000, 18000, { id: 'b', name: 'Oat milk' }),
      milk(190000, 18000, { id: 'x', name: 'Old syrup', is_active: false }),
      milk(0, 5000, { id: 'c', name: 'Cups 16oz', reorder_level: 5000 }),
      milk(900, 500, { id: 'a', name: 'Ice', reorder_level: 1000 }),
    ]);
    expect(r.map((a) => [a.name, a.status])).toEqual([
      ['Cups 16oz', 'OUT'],
      ['Ice', 'LOW'],
      ['Oat milk', 'LOW'],
    ]);
  });
});
