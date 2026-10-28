import { RewardType } from '../../generated/prisma/enums.js';

export interface DiscountReward {
  type: RewardType;
  discount_satang: number | null;
  max_discount_satang: number | null;
  product_id: string | null;
  percent?: number | null;
  min_spend_satang?: number | null;
  option_ids?: string[];
  product_ids?: string[];
  category_ids?: string[];
  buy_qty?: number | null;
  get_qty?: number | null;
  get_percent?: number | null;
}

export interface DiscountLine {
  product_id: string;
  category_id?: string | null;
  /// price of one unit, options included
  unit_price_satang: number;
  quantity?: number;
  /// options on the line and what each added to the unit price
  options?: { option_id: string; price_delta_satang: number }[];
}

export type DiscountResult = { ok: true; amount: number } | { ok: false; reason: 'ITEM_MISSING' | 'MIN_SPEND' };

const cap = (amount: number, max: number | null | undefined, subtotal: number) => Math.max(0, Math.min(amount, max ?? amount, subtotal));

// Lines a reward applies to (no product/category filter = every line)
function eligible(reward: DiscountReward, lines: DiscountLine[]) {
  const products = reward.product_ids ?? [];
  const categories = reward.category_ids ?? [];
  if (products.length === 0 && categories.length === 0) return lines;
  return lines.filter((l) => products.includes(l.product_id) || (l.category_id != null && categories.includes(l.category_id)));
}

/// a unit's price without the options added to it
export const basePrice = (l: DiscountLine) => l.unit_price_satang - (l.options ?? []).reduce((n, o) => n + o.price_delta_satang, 0);

/// lines a free-item reward can take: its product, or any of its products / categories
export function freeItemLines(reward: DiscountReward, lines: DiscountLine[]) {
  return lines.filter(
    (l) =>
      l.product_id === reward.product_id ||
      (reward.product_ids ?? []).includes(l.product_id) ||
      (l.category_id != null && (reward.category_ids ?? []).includes(l.category_id)),
  );
}

// The discount a reward gives on these lines — never more than the subtotal. Decided by the API at order create.
export function rewardDiscount(reward: DiscountReward, lines: DiscountLine[], subtotalSatang: number): DiscountResult {
  if (reward.min_spend_satang && subtotalSatang < reward.min_spend_satang) return { ok: false, reason: 'MIN_SPEND' };

  switch (reward.type) {
    case RewardType.FIXED_DISCOUNT:
      return { ok: true, amount: cap(reward.discount_satang ?? 0, null, subtotalSatang) };

    case RewardType.FREE_ITEM: {
      // one unit of the item at its base price: paid extras (size-up, oat milk) stay on the bill.
      // The priciest matching unit if several, capped.
      const prices = freeItemLines(reward, lines).map((l) => basePrice(l));
      if (prices.length === 0) return { ok: false, reason: 'ITEM_MISSING' };
      return { ok: true, amount: cap(Math.max(...prices), reward.max_discount_satang, subtotalSatang) };
    }

    case RewardType.PERCENT_OFF: {
      const hits = eligible(reward, lines);
      if (hits.length === 0) return { ok: false, reason: 'ITEM_MISSING' };
      const filtered = (reward.product_ids?.length ?? 0) + (reward.category_ids?.length ?? 0) > 0;
      const base = filtered ? hits.reduce((n, l) => n + l.unit_price_satang * (l.quantity ?? 1), 0) : subtotalSatang;
      return { ok: true, amount: cap(Math.floor((base * (reward.percent ?? 0)) / 100), reward.max_discount_satang, subtotalSatang) };
    }

    case RewardType.FREE_OPTION: {
      // one unit's chosen option (e.g. the size-up) is free, the priciest if several match
      const wanted = reward.option_ids ?? [];
      const deltas = eligible(reward, lines).flatMap((l) => (l.options ?? []).filter((o) => wanted.includes(o.option_id)).map((o) => o.price_delta_satang));
      if (deltas.length === 0) return { ok: false, reason: 'ITEM_MISSING' };
      return { ok: true, amount: cap(Math.max(...deltas), reward.max_discount_satang, subtotalSatang) };
    }

    case RewardType.BUY_X_GET_Y: {
      // once per voucher: with at least buy+get eligible units, the get cheapest are get_percent% off
      const buy = reward.buy_qty ?? 1;
      const get = reward.get_qty ?? 1;
      const units = eligible(reward, lines)
        .flatMap((l) => Array.from({ length: l.quantity ?? 1 }, () => l.unit_price_satang))
        .sort((a, b) => b - a);
      if (units.length < buy + get) return { ok: false, reason: 'ITEM_MISSING' };
      const free = units.slice(-get).reduce((n, p) => n + p, 0);
      return { ok: true, amount: cap(Math.floor((free * (reward.get_percent ?? 100)) / 100), reward.max_discount_satang, subtotalSatang) };
    }
  }
}
