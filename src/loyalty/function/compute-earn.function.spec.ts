import { describe, expect, it } from 'vitest';
import { EarnRuleKind, LoyaltyCurrency } from '../../generated/prisma/enums.js';
import { BASE_EARN_LABEL, bangkokClock, computeEarn, ruleInSchedule, type EarnRuleInput } from './compute-earn.function.js';

const base = { points_per_unit: 1, unit_satang: 1000 };
const order = {
  total_satang: 14500,
  subtotal_satang: 14500,
  items: [
    { product_id: 'latte', category_id: 'coffee', quantity: 1, line_total_satang: 8000 },
    { product_id: 'croissant', category_id: 'bakery', quantity: 1, line_total_satang: 6500 },
  ],
};
const rule = (r: Partial<EarnRuleInput>): EarnRuleInput => ({
  name: 'rule',
  kind: EarnRuleKind.BONUS,
  is_active: true,
  amount: 0,
  currency: LoyaltyCurrency.POINTS,
  multiplier_x10: 10,
  per_item: false,
  min_spend_satang: 0,
  min_items: 0,
  product_ids: [],
  category_ids: [],
  weekdays: [],
  time_from: null,
  time_to: null,
  starts_at: null,
  ends_at: null,
  stackable: false,
  ...r,
});
// Monday 15:00 in Bangkok = 08:00 UTC
const monday3pm = new Date('2026-10-19T08:00:00Z');

describe('bangkok clock and schedules', () => {
  it('reads Thailand time', () => {
    expect(bangkokClock(monday3pm)).toEqual({ weekday: 1, minutes: 15 * 60 });
    expect(bangkokClock(new Date('2026-10-18T20:30:00Z'))).toEqual({ weekday: 1, minutes: 3 * 60 + 30 }); // Sunday UTC = Monday 03:30 BKK
  });

  it('checks weekdays, time windows (also across midnight) and dates', () => {
    expect(ruleInSchedule(rule({ weekdays: [1] }), monday3pm)).toBe(true);
    expect(ruleInSchedule(rule({ weekdays: [2] }), monday3pm)).toBe(false);
    expect(ruleInSchedule(rule({ time_from: 14 * 60, time_to: 16 * 60 }), monday3pm)).toBe(true);
    expect(ruleInSchedule(rule({ time_from: 16 * 60, time_to: 18 * 60 }), monday3pm)).toBe(false);
    expect(ruleInSchedule(rule({ time_from: 22 * 60, time_to: 2 * 60 }), new Date('2026-10-18T16:30:00Z'))).toBe(true); // 23:30
    expect(ruleInSchedule(rule({ ends_at: new Date('2026-10-01') }), monday3pm)).toBe(false);
    expect(ruleInSchedule(rule({ is_active: false }), monday3pm)).toBe(false);
  });
});

describe('computeEarn', () => {
  it('earns base points', () => {
    expect(computeEarn(order, base, [], monday3pm)).toEqual({ points: 14, stamps: 0, lines: [{ label: BASE_EARN_LABEL, points: 14, stamps: 0 }] });
  });

  it('double points on Mondays; only the best non-stackable multiplier counts', () => {
    const rules = [rule({ name: '2× Monday', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 20, weekdays: [1] }), rule({ name: '1.5× afternoon', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 15 })];
    const e = computeEarn(order, base, rules, monday3pm);
    expect(e.points).toBe(28);
    expect(e.lines.map((l) => l.label)).toEqual([BASE_EARN_LABEL, '2× Monday']);
  });

  it('stackable multipliers add up', () => {
    const rules = [rule({ name: 'a', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 20, stackable: true }), rule({ name: 'b', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 15, stackable: true })];
    expect(computeEarn(order, base, rules, monday3pm).points).toBe(14 + 14 + 7);
  });

  it('a multiplier on a category counts only those items', () => {
    const r = rule({ name: '3× coffee', kind: EarnRuleKind.MULTIPLIER, multiplier_x10: 30, category_ids: ['coffee'] });
    expect(computeEarn(order, base, [r], monday3pm).points).toBe(14 + 16);
  });

  it('stamps per visit or per qualifying item, with minimums', () => {
    const visit = rule({ name: 'Stamp', kind: EarnRuleKind.STAMPS_PER_VISIT, amount: 1, min_spend_satang: 5000 });
    expect(computeEarn(order, base, [visit], monday3pm).stamps).toBe(1);
    expect(computeEarn({ ...order, total_satang: 4000 }, base, [visit], monday3pm).stamps).toBe(0);
    const perDrink = rule({ name: 'Stamp per coffee', kind: EarnRuleKind.STAMPS_PER_VISIT, amount: 1, per_item: true, category_ids: ['coffee'] });
    expect(computeEarn(order, base, [perDrink], monday3pm).stamps).toBe(1);
  });

  it('bonus points or stamps when the order has a product', () => {
    const r = rule({ name: 'New menu +10', amount: 10, product_ids: ['croissant'] });
    expect(computeEarn(order, base, [r], monday3pm).points).toBe(24);
    expect(computeEarn(order, base, [{ ...r, product_ids: ['matcha'] }], monday3pm).points).toBe(14);
    expect(computeEarn(order, base, [{ ...r, currency: LoyaltyCurrency.STAMPS, amount: 2 }], monday3pm)).toMatchObject({ points: 14, stamps: 2 });
  });

  it('base points can be off (stamps-only shop)', () => {
    const r = rule({ name: 'Stamp', kind: EarnRuleKind.STAMPS_PER_VISIT, amount: 1 });
    expect(computeEarn(order, { points_per_unit: 0, unit_satang: 1000 }, [r], monday3pm)).toEqual({ points: 0, stamps: 1, lines: [{ label: 'Stamp', points: 0, stamps: 1 }] });
  });
});
