import { EarnRuleKind, LoyaltyCurrency } from '../../generated/prisma/enums.js';
import { pointsForTotal } from './points-for-total.function.js';

export interface EarnItem {
  product_id: string;
  category_id: string | null;
  quantity: number;
  line_total_satang: number;
}

export interface EarnOrder {
  /// what was paid (after any reward discount)
  total_satang: number;
  /// before discounts; scales filtered amounts down when there was a discount
  subtotal_satang: number;
  items: EarnItem[];
}

export interface EarnRuleInput {
  name: string;
  kind: EarnRuleKind;
  is_active: boolean;
  amount: number;
  currency: LoyaltyCurrency;
  multiplier_x10: number;
  per_item: boolean;
  min_spend_satang: number;
  min_items: number;
  product_ids: string[];
  category_ids: string[];
  weekdays: number[];
  time_from: number | null;
  time_to: number | null;
  starts_at: Date | null;
  ends_at: Date | null;
  stackable: boolean;
}

export interface EarnLine {
  label: string;
  points: number;
  stamps: number;
}

export interface Earn {
  points: number;
  stamps: number;
  lines: EarnLine[];
}

export const BASE_EARN_LABEL = 'สะสมจากยอดซื้อ';
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000; // no daylight saving in Thailand

// Day of week (0 = Sunday) and minutes since midnight, in Thailand time
export function bangkokClock(now: Date): { weekday: number; minutes: number } {
  const local = new Date(now.getTime() + BANGKOK_OFFSET_MS);
  return { weekday: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

// Active, inside its dates, on an allowed weekday and inside its time window (a window may cross midnight)
export function ruleInSchedule(rule: Pick<EarnRuleInput, 'is_active' | 'weekdays' | 'time_from' | 'time_to' | 'starts_at' | 'ends_at'>, now: Date): boolean {
  if (!rule.is_active) return false;
  if (rule.starts_at && now < rule.starts_at) return false;
  if (rule.ends_at && now >= rule.ends_at) return false;
  const { weekday, minutes } = bangkokClock(now);
  if (rule.weekdays.length > 0 && !rule.weekdays.includes(weekday)) return false;
  if (rule.time_from != null && rule.time_to != null && rule.time_from !== rule.time_to) {
    const inside = rule.time_from < rule.time_to ? minutes >= rule.time_from && minutes < rule.time_to : minutes >= rule.time_from || minutes < rule.time_to;
    if (!inside) return false;
  }
  return true;
}

// Items a rule cares about (no product/category filter = every item)
function qualifying(rule: Pick<EarnRuleInput, 'product_ids' | 'category_ids'>, items: EarnItem[]) {
  const filtered = rule.product_ids.length === 0 && rule.category_ids.length === 0;
  const hits = filtered
    ? items
    : items.filter((i) => rule.product_ids.includes(i.product_id) || (i.category_id != null && rule.category_ids.includes(i.category_id)));
  return {
    filtered: !filtered,
    count: hits.reduce((n, i) => n + i.quantity, 0),
    amount: hits.reduce((n, i) => n + i.line_total_satang, 0),
  };
}

// What a paid order earns: base points per ฿, then the owner's extra rules.
// Member-specific extras (welcome, tier) are added at claim time, not here.
export function computeEarn(order: EarnOrder, base: { points_per_unit: number; unit_satang: number }, rules: EarnRuleInput[], now: Date): Earn {
  const lines: EarnLine[] = [];
  const basePoints = pointsForTotal(order.total_satang, base);
  if (basePoints > 0) lines.push({ label: BASE_EARN_LABEL, points: basePoints, stamps: 0 });

  // a reward discount lowers the paid total; filtered amounts shrink in proportion
  const paidShare = order.subtotal_satang > 0 ? order.total_satang / order.subtotal_satang : 0;
  let bestSolo: EarnLine | null = null;

  for (const rule of rules) {
    if (!ruleInSchedule(rule, now)) continue;
    const q = qualifying(rule, order.items);
    if (q.count === 0) continue;
    if (order.total_satang < rule.min_spend_satang || q.count < rule.min_items) continue;

    if (rule.kind === EarnRuleKind.MULTIPLIER) {
      const eligible = q.filtered ? Math.floor(q.amount * paidShare) : order.total_satang;
      const extra = Math.floor((pointsForTotal(eligible, base) * (rule.multiplier_x10 - 10)) / 10);
      if (extra <= 0) continue;
      const line = { label: rule.name, points: extra, stamps: 0 };
      if (rule.stackable) lines.push(line);
      else if (!bestSolo || extra > bestSolo.points) bestSolo = line;
      continue;
    }

    const n = rule.per_item ? rule.amount * q.count : rule.amount;
    if (n <= 0) continue;
    const stamps = rule.kind === EarnRuleKind.STAMPS_PER_VISIT || rule.currency === LoyaltyCurrency.STAMPS;
    lines.push({ label: rule.name, points: stamps ? 0 : n, stamps: stamps ? n : 0 });
  }
  if (bestSolo) lines.push(bestSolo);

  return {
    points: lines.reduce((n, l) => n + l.points, 0),
    stamps: lines.reduce((n, l) => n + l.stamps, 0),
    lines,
  };
}
