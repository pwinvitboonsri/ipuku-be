import { describe, expect, it } from 'vitest';
import {
  buildShiftReport,
  type ReportAuditInput,
  type ReportOrderInput,
  type ReportSessionInput,
} from './build-shift-report.function.js';

// Money in satang (฿65.00 -> 6500)
const ANN = { id: 'staff-ann', name: 'Ann' };
const BEN = { id: 'staff-ben', name: 'Ben' };
const COFFEE = { id: 'cat-coffee', name: 'Coffee' };
const TEA = { id: 'cat-tea', name: 'Tea' };

const t = (hhmm: string) => new Date(`2026-10-02T${hhmm}:00.000Z`);

const session = (over: Partial<ReportSessionInput> = {}): ReportSessionInput => ({
  id: 'sess-1',
  opening_float_satang: 100000,
  counted_cash_satang: null,
  expect_cash_satang: null,
  variance_satang: null,
  open_at: t('01:00'),
  close_at: null,
  opened_by_staff: ANN,
  close_by_staff: null,
  ...over,
});

const latte = (quantity: number, large = false) => ({
  product_id: 'latte',
  product_name_snapshot: 'Iced latte',
  quantity,
  line_total_satang: (6500 + (large ? 1000 : 0)) * quantity,
  product: { category: COFFEE },
  order_item_modifier: large
    ? [{ modifier_option_id: 'opt-large', name_snapshot: 'Large', price_delta_satang: 1000 }]
    : [],
});

const greenTea = (quantity: number) => ({
  product_id: 'green-tea',
  product_name_snapshot: 'Green tea',
  quantity,
  line_total_satang: 5000 * quantity,
  product: { category: TEA },
  order_item_modifier: [],
});

let n = 0;
const order = (
  over: Partial<ReportOrderInput> & Pick<ReportOrderInput, 'order_item'>,
): ReportOrderInput => {
  const subtotal = over.order_item.reduce((s, i) => s + i.line_total_satang, 0);
  const discount = over.discount_satang ?? 0;
  n += 1;
  return {
    id: `order-${n}`,
    order_number: n,
    status: 'PAID',
    subtotal_satang: subtotal,
    discount_satang: discount,
    total_satang: subtotal - discount,
    paid_at: t('02:10'),
    create_at: t('02:05'),
    staff: ANN,
    payment: [],
    ...over,
  };
};

const cash = (amount: number, tender: number, at = t('02:10')) => ({
  method: 'CASH' as const,
  amount_satang: amount,
  tender_satang: tender,
  change_satang: tender - amount,
  create_at: at,
});
const promptpay = (amount: number, at = t('02:10')) => ({
  method: 'PROMPTPAY' as const,
  amount_satang: amount,
  tender_satang: null,
  change_satang: null,
  create_at: at,
});

function fixture() {
  n = 0;
  // #1 cash, 2 large lattes = 15000, paid with 20000
  const o1 = order({ order_item: [latte(2, true)], payment: [cash(15000, 20000)] });
  // #2 PromptPay, latte + tea = 11500, at 03:xx by Ben
  const o2 = order({
    order_item: [latte(1), greenTea(1)],
    staff: BEN,
    paid_at: t('03:20'),
    payment: [promptpay(11500, t('03:20'))],
  });
  // #3 cash 5000 then refunded
  const o3 = order({
    status: 'REFUNDED',
    order_item: [greenTea(1)],
    payment: [cash(5000, 5000), cash(-5000, 0, t('02:30'))],
  });
  o3.payment[1].tender_satang = null;
  o3.payment[1].change_satang = null;
  // #4 voided, never paid
  const o4 = order({ status: 'VOIDED', paid_at: null, staff: BEN, order_item: [latte(1)] });
  // #5 cash with a 1000 discount: 6500 - 1000 = 5500
  const o5 = order({ discount_satang: 1000, order_item: [latte(1)], payment: [cash(5500, 10000)] });

  const audit: ReportAuditInput[] = [
    { action: 'REFUND_ORDER', entity_id: o3.id, metadata: { reason: 'Wrong drink', method: 'CASH' }, create_at: t('02:30'), staff: ANN },
    { action: 'VOID_ORDER', entity_id: o4.id, metadata: { reason: 'Customer left' }, create_at: t('02:40'), staff: BEN },
  ];
  return { orders: [o1, o2, o3, o4, o5], audit };
}

describe('buildShiftReport', () => {
  it('adds up gross, discounts, refunds and net', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(session(), orders, audit);

    // gross = PAID + REFUNDED subtotals: 15000 + 11500 + 5000 + 6500
    expect(r.summary.gross_sales_satang).toBe(38000);
    expect(r.summary.discounts_satang).toBe(1000);
    expect(r.summary.refunds_satang).toBe(5000);
    // net = Σ total of PAID orders
    expect(r.summary.net_sales_satang).toBe(15000 + 11500 + 5500);
    expect(r.summary.paid_orders).toBe(3);
    expect(r.summary.items_sold).toBe(2 + 2 + 1);
    expect(r.summary.avg_ticket_satang).toBe(Math.round(32000 / 3));
  });

  it('splits tenders and reconciles the drawer', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(session(), orders, audit);

    expect(r.tenders).toEqual([
      { method: 'CASH', count: 3, sales_satang: 25500, refunds_satang: 5000, net_satang: 20500 },
      { method: 'PROMPTPAY', count: 1, sales_satang: 11500, refunds_satang: 0, net_satang: 11500 },
    ]);
    // open session: expected computed live, nothing counted yet
    expect(r.cash).toEqual({
      opening_float_satang: 100000,
      cash_sales_satang: 25500,
      cash_refunds_satang: 5000,
      expected_satang: 120500,
      counted_satang: null,
      variance_satang: null,
      tendered_satang: 20000 + 5000 + 10000,
      change_given_satang: 5000 + 0 + 4500,
    });
  });

  it('keeps the numbers a closed session was closed with', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(
      session({
        close_at: t('05:31'),
        close_by_staff: BEN,
        expect_cash_satang: 120500,
        counted_cash_satang: 120000,
        variance_satang: -500,
      }),
      orders,
      audit,
    );
    expect(r.cash.expected_satang).toBe(120500);
    expect(r.cash.counted_satang).toBe(120000);
    expect(r.cash.variance_satang).toBe(-500);
    expect(r.session.duration_minutes).toBe(271);
    expect(r.session.closed_by).toEqual(BEN);
    expect(r.session.first_order_number).toBe(1);
    expect(r.session.last_order_number).toBe(5);
  });

  it('lists voids and refunds with their audit reasons', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(session(), orders, audit);

    expect(r.voids).toEqual({
      count: 1,
      amount_satang: 6500,
      list: [{ order_id: 'order-4', order_number: 4, amount_satang: 6500, method: null, staff_name: 'Ben', at: t('02:40'), reason: 'Customer left' }],
    });
    expect(r.refunds).toEqual({
      count: 1,
      amount_satang: 5000,
      list: [{ order_id: 'order-3', order_number: 3, amount_satang: 5000, method: 'CASH', staff_name: 'Ann', at: t('02:30'), reason: 'Wrong drink' }],
    });
  });

  it('counts items, categories and add-ons from PAID orders only, times quantity', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(session(), orders, audit);

    expect(r.items).toEqual([
      // 2 large (2×7500) + 1 regular (6500, from #2) + 1 regular (#5)
      { product_id: 'latte', name: 'Iced latte', category_name: 'Coffee', quantity: 4, revenue_satang: 15000 + 6500 + 6500 },
      // refunded tea (#3) not counted
      { product_id: 'green-tea', name: 'Green tea', category_name: 'Tea', quantity: 1, revenue_satang: 5000 },
    ]);
    expect(r.categories.map((c) => [c.name, c.quantity, c.revenue_satang])).toEqual([
      ['Coffee', 4, 28000],
      ['Tea', 1, 5000],
    ]);
    expect(r.modifiers).toEqual([{ modifier_option_id: 'opt-large', name: 'Large', quantity: 2, revenue_satang: 2000 }]);
  });

  it('breaks down by staff and by hour', () => {
    const { orders, audit } = fixture();
    const r = buildShiftReport(session(), orders, audit);

    expect(r.staff).toEqual([
      { staff_id: 'staff-ann', name: 'Ann', paid_orders: 2, net_sales_satang: 20500, voids: 0, refunds: 1 },
      { staff_id: 'staff-ben', name: 'Ben', paid_orders: 1, net_sales_satang: 11500, voids: 1, refunds: 0 },
    ]);
    expect(r.hourly).toEqual([
      { hour_start: t('02:00'), orders: 2, net_sales_satang: 20500 },
      { hour_start: t('03:00'), orders: 1, net_sales_satang: 11500 },
    ]);
  });

  it('splits a mixed payment and its refund across methods', () => {
    const { orders, audit } = fixture();
    // #6 ฿200 order: ฿120 PromptPay + ฿80 cash (paid with ฿100) — kept
    const o6 = order({
      order_item: [greenTea(4)],
      payment: [promptpay(12000), cash(8000, 10000)],
    });
    // #7 ฿200 split the same way, then refunded per tender
    const o7 = order({
      status: 'REFUNDED',
      order_item: [greenTea(4)],
      payment: [promptpay(12000), cash(8000, 8000), promptpay(-12000, t('02:50')), { ...cash(-8000, 0, t('02:50')), tender_satang: null, change_satang: null }],
    });
    audit.push({ action: 'REFUND_ORDER', entity_id: o7.id, metadata: { reason: 'Spilled' }, create_at: t('02:50'), staff: ANN });
    const r = buildShiftReport(session(), [...orders, o6, o7], audit);

    expect(r.summary.split_orders).toBe(2);
    expect(r.summary.net_sales_satang).toBe(32000 + 20000);
    expect(r.tenders).toEqual([
      // cash: 3 earlier + 2 split parts; refunds: 5000 earlier + 8000 split part
      { method: 'CASH', count: 5, sales_satang: 25500 + 16000, refunds_satang: 13000, net_satang: 28500 },
      { method: 'PROMPTPAY', count: 3, sales_satang: 11500 + 24000, refunds_satang: 12000, net_satang: 23500 },
    ]);
    // only the cash part of the kept split order lands in the drawer
    expect(r.cash.expected_satang).toBe(100000 + 20500 + 8000);
    expect(r.cash.change_given_satang).toBe(9500 + 2000);
    expect(r.refunds.list.find((x) => x.order_number === 7)).toMatchObject({ amount_satang: 20000, method: 'MIXED', reason: 'Spilled' });
    expect(r.refunds.amount_satang).toBe(25000);
  });

  it('handles an empty shift', () => {
    const r = buildShiftReport(session(), [], []);
    expect(r.summary).toEqual({
      gross_sales_satang: 0,
      discounts_satang: 0,
      refunds_satang: 0,
      net_sales_satang: 0,
      paid_orders: 0,
      items_sold: 0,
      avg_ticket_satang: 0,
      split_orders: 0,
    });
    expect(r.cash.expected_satang).toBe(100000);
    expect(r.session.first_order_number).toBeNull();
    expect(r.items).toEqual([]);
    expect(r.hourly).toEqual([]);
  });
});
