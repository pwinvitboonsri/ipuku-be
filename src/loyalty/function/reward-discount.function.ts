import { RewardType } from '../../generated/prisma/enums.js';

export interface DiscountReward {
  type: RewardType;
  discount_satang: number | null;
  max_discount_satang: number | null;
  product_id: string | null;
}

export interface DiscountLine {
  product_id: string;
  unit_price_satang: number;
}

// The discount a reward gives on these lines, never more than the subtotal.
// FREE_ITEM takes the priciest matching unit (any options), capped by max_discount_satang.
// null when a FREE_ITEM's product isn't in the order.
export function rewardDiscount(reward: DiscountReward, lines: DiscountLine[], subtotalSatang: number): number | null {
  if (reward.type === RewardType.FIXED_DISCOUNT) {
    return Math.min(reward.discount_satang ?? 0, subtotalSatang);
  }
  const prices = lines.filter((l) => l.product_id === reward.product_id).map((l) => l.unit_price_satang);
  if (prices.length === 0) return null;
  const unit = Math.max(...prices);
  const cap = reward.max_discount_satang ?? unit;
  return Math.min(unit, cap, subtotalSatang);
}
