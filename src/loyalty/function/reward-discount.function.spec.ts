import { describe, expect, it } from 'vitest';
import { RewardType } from '../../generated/prisma/enums.js';
import { rewardDiscount, type DiscountReward } from './reward-discount.function.js';

const lines = [
  { product_id: 'latte', category_id: 'coffee', unit_price_satang: 9500, quantity: 1, options: [{ option_id: 'large', price_delta_satang: 1500 }, { option_id: 'oat', price_delta_satang: 1500 }] },
  { product_id: 'latte', category_id: 'coffee', unit_price_satang: 8000, quantity: 1, options: [] },
  { product_id: 'americano', category_id: 'coffee', unit_price_satang: 6000, quantity: 2, options: [] },
  { product_id: 'croissant', category_id: 'bakery', unit_price_satang: 6500, quantity: 1, options: [] },
];
const subtotal = 9500 + 8000 + 12000 + 6500; // 36000
const base: DiscountReward = { type: RewardType.FIXED_DISCOUNT, discount_satang: null, max_discount_satang: null, product_id: null };

describe('rewardDiscount', () => {
  it('fixed baht, capped by the subtotal', () => {
    expect(rewardDiscount({ ...base, discount_satang: 2000 }, lines, subtotal)).toEqual({ ok: true, amount: 2000 });
    expect(rewardDiscount({ ...base, discount_satang: 2000 }, lines, 1500)).toEqual({ ok: true, amount: 1500 });
  });

  it('free item: base price of the priciest matching unit (extras stay paid), up to the cap, or ITEM_MISSING', () => {
    const r = { ...base, type: RewardType.FREE_ITEM, product_id: 'latte', max_discount_satang: null };
    // large oat latte 95 − 30 extras = 65 base; plain latte 80 → 80
    expect(rewardDiscount(r, lines, subtotal)).toEqual({ ok: true, amount: 8000 });
    expect(rewardDiscount(r, [lines[0]], subtotal)).toEqual({ ok: true, amount: 6500 });
    expect(rewardDiscount({ ...r, max_discount_satang: 7000 }, lines, subtotal)).toEqual({ ok: true, amount: 7000 });
    // a category free item takes any matching line
    expect(rewardDiscount({ ...r, product_id: null, category_ids: ['bakery'] }, lines, subtotal)).toEqual({ ok: true, amount: 6500 });
    expect(rewardDiscount({ ...r, product_id: 'matcha' }, lines, subtotal)).toEqual({ ok: false, reason: 'ITEM_MISSING' });
  });

  it('percent off the order or only eligible lines, capped', () => {
    const r = { ...base, type: RewardType.PERCENT_OFF, percent: 15, max_discount_satang: 5000 };
    expect(rewardDiscount(r, lines, subtotal)).toEqual({ ok: true, amount: 5000 }); // 15% of 360 = 54 → cap 50
    expect(rewardDiscount({ ...r, category_ids: ['bakery'] }, lines, subtotal)).toEqual({ ok: true, amount: 975 });
    expect(rewardDiscount({ ...r, category_ids: ['tea'] }, lines, subtotal)).toEqual({ ok: false, reason: 'ITEM_MISSING' });
  });

  it('respects a minimum spend', () => {
    const r = { ...base, type: RewardType.PERCENT_OFF, percent: 10, min_spend_satang: 50000 };
    expect(rewardDiscount(r, lines, subtotal)).toEqual({ ok: false, reason: 'MIN_SPEND' });
  });

  it('free option: one unit of a chosen option', () => {
    const r = { ...base, type: RewardType.FREE_OPTION, option_ids: ['large', 'oat'], max_discount_satang: null };
    expect(rewardDiscount(r, lines, subtotal)).toEqual({ ok: true, amount: 1500 });
    expect(rewardDiscount({ ...r, option_ids: ['shot'] }, lines, subtotal)).toEqual({ ok: false, reason: 'ITEM_MISSING' });
  });

  it('buy X get Y: the cheapest eligible units, once', () => {
    const r = { ...base, type: RewardType.BUY_X_GET_Y, category_ids: ['coffee'], buy_qty: 2, get_qty: 1, get_percent: 100 };
    expect(rewardDiscount(r, lines, subtotal)).toEqual({ ok: true, amount: 6000 }); // 4 coffees → one americano free
    expect(rewardDiscount({ ...r, get_percent: 50 }, lines, subtotal)).toEqual({ ok: true, amount: 3000 });
    expect(rewardDiscount({ ...r, buy_qty: 4 }, lines, subtotal)).toEqual({ ok: false, reason: 'ITEM_MISSING' });
  });
});
