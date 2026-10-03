import { describe, expect, it } from 'vitest';
import {
  computeIngredientRequirements,
  type BaseRecipeLine,
  type ModifierRecipeLine,
} from './ingredient-requirements.function.js';

// Quantities in hundredths (180 ml -> 18000)
const LATTE = 'iced-latte';
const TEA = 'iced-green-tea';
const OJ = 'orange-juice';
const LARGE = 'opt-large';
const OAT = 'opt-oat';
const NO_ICE = 'opt-no-ice';

const base: BaseRecipeLine[] = [
  { product_id: LATTE, ingredient_id: 'whole', quantity_per_unit: 18000 },
  { product_id: LATTE, ingredient_id: 'ice', quantity_per_unit: 15000 },
  { product_id: TEA, ingredient_id: 'concentrate', quantity_per_unit: 10000 },
  { product_id: TEA, ingredient_id: 'ice', quantity_per_unit: 15000 },
  { product_id: OJ, ingredient_id: 'orange', quantity_per_unit: 300 },
];

const mods: ModifierRecipeLine[] = [
  // "Large" is one option, reused — but different per product
  { product_id: LATTE, modifier_option_id: LARGE, ingredient_id: 'whole', quantity_delta: 10000 },
  { product_id: LATTE, modifier_option_id: LARGE, ingredient_id: 'ice', quantity_delta: 10000 },
  { product_id: LATTE, modifier_option_id: LARGE, ingredient_id: 'cup-l', quantity_delta: 100 },
  { product_id: TEA, modifier_option_id: LARGE, ingredient_id: 'concentrate', quantity_delta: 5000 },
  { product_id: TEA, modifier_option_id: LARGE, ingredient_id: 'ice', quantity_delta: 10000 },
  { product_id: OJ, modifier_option_id: LARGE, ingredient_id: 'orange', quantity_delta: 100 },
  // substitution: oat replaces whole milk
  { product_id: LATTE, modifier_option_id: OAT, ingredient_id: 'whole', quantity_delta: -18000 },
  { product_id: LATTE, modifier_option_id: OAT, ingredient_id: 'oat', quantity_delta: 18000 },
  // "no ice" removes more than the base — must clamp, not refund
  { product_id: LATTE, modifier_option_id: NO_ICE, ingredient_id: 'ice', quantity_delta: -99900 },
];

const run = (items: { product_id: string; quantity: number; modifier_option_ids: string[] }[]) =>
  Object.fromEntries(computeIngredientRequirements(items, base, mods));

describe('computeIngredientRequirements', () => {
  it('uses the base recipe when no options are selected', () => {
    expect(run([{ product_id: LATTE, quantity: 1, modifier_option_ids: [] }])).toEqual({ whole: 18000, ice: 15000 });
  });

  it('adds the selected option deltas on top of the base', () => {
    expect(run([{ product_id: LATTE, quantity: 1, modifier_option_ids: [LARGE] }])).toEqual({ whole: 28000, ice: 25000, 'cup-l': 100 });
  });

  it('the same option means different ingredients on different products', () => {
    expect(run([{ product_id: TEA, quantity: 1, modifier_option_ids: [LARGE] }])).toEqual({ concentrate: 15000, ice: 25000 });
    expect(run([{ product_id: OJ, quantity: 1, modifier_option_ids: [LARGE] }])).toEqual({ orange: 400 });
  });

  it('supports negative deltas for substitutions and drops zero totals', () => {
    expect(run([{ product_id: LATTE, quantity: 1, modifier_option_ids: [OAT] }])).toEqual({ ice: 15000, oat: 18000 });
  });

  it('clamps an ingredient at 0 per item instead of returning stock', () => {
    expect(run([{ product_id: LATTE, quantity: 2, modifier_option_ids: [NO_ICE] }])).toEqual({ whole: 36000 });
  });

  it('multiplies by quantity', () => {
    expect(run([{ product_id: LATTE, quantity: 3, modifier_option_ids: [] }])).toEqual({ whole: 54000, ice: 45000 });
  });

  it('sums shared ingredients across all items of the order into one total', () => {
    const r = run([
      { product_id: LATTE, quantity: 2, modifier_option_ids: [LARGE, OAT] },
      { product_id: TEA, quantity: 1, modifier_option_ids: [LARGE] },
    ]);
    // latte L+oat per unit: whole 18000+10000-18000=10000, ice 25000, cup 100, oat 18000
    expect(r).toEqual({ whole: 20000, ice: 50000 + 25000, 'cup-l': 200, oat: 36000, concentrate: 15000 });
  });

  it('ignores option rows that belong to another product', () => {
    // OAT is only defined for the latte; on the tea it changes nothing
    expect(run([{ product_id: TEA, quantity: 1, modifier_option_ids: [OAT] }])).toEqual({ concentrate: 10000, ice: 15000 });
  });

  it('returns nothing for products without a recipe', () => {
    expect(run([{ product_id: 'cookie', quantity: 4, modifier_option_ids: [] }])).toEqual({});
  });
});
