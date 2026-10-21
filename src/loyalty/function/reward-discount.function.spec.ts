import { describe, expect, it } from 'vitest';
import { RewardType } from '../../generated/prisma/enums.js';
import { rewardDiscount } from './reward-discount.function.js';

const lines = [
  { product_id: 'latte', unit_price_satang: 8000 },
  { product_id: 'latte', unit_price_satang: 7000 },
  { product_id: 'croissant', unit_price_satang: 6500 },
];

describe('rewardDiscount', () => {
  it('gives a fixed amount, capped by the subtotal', () => {
    const r = { type: RewardType.FIXED_DISCOUNT, discount_satang: 2000, max_discount_satang: null, product_id: null };
    expect(rewardDiscount(r, lines, 21500)).toBe(2000);
    expect(rewardDiscount(r, lines, 1500)).toBe(1500);
  });

  it('frees the priciest matching item up to the cap', () => {
    const r = { type: RewardType.FREE_ITEM, discount_satang: null, max_discount_satang: 9500, product_id: 'latte' };
    expect(rewardDiscount(r, lines, 21500)).toBe(8000);
    expect(rewardDiscount({ ...r, max_discount_satang: 7500 }, lines, 21500)).toBe(7500);
  });

  it('returns null when the free item is not in the order', () => {
    const r = { type: RewardType.FREE_ITEM, discount_satang: null, max_discount_satang: 9500, product_id: 'matcha' };
    expect(rewardDiscount(r, lines, 21500)).toBeNull();
  });
});
