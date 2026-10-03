// End-of-shift sales report (Z-report). Pure: the service loads one session,
// its orders and the void/refund audit rows, and everything is added up here.
// All money in satang.
//
// An order is paid by one or more tenders (mixed: PromptPay + cash). Refunds are
// full-order only: one negative row per tender, same method, order -> REFUNDED.
// So net sales = Σ total of PAID orders.

type Method = 'CASH' | 'PROMPTPAY';
type OrderStatus = 'OPEN' | 'PAID' | 'VOIDED' | 'REFUNDED';

export type ReportSessionInput = {
  id: string;
  opening_float_satang: number;
  counted_cash_satang: number | null;
  expect_cash_satang: number | null;
  variance_satang: number | null;
  open_at: Date;
  close_at: Date | null;
  opened_by_staff: { id: string; name: string };
  close_by_staff: { id: string; name: string } | null;
};

export type ReportOrderInput = {
  id: string;
  order_number: number;
  status: OrderStatus;
  subtotal_satang: number;
  discount_satang: number;
  total_satang: number;
  paid_at: Date | null;
  create_at: Date;
  staff: { id: string; name: string };
  order_item: {
    product_id: string;
    product_name_snapshot: string;
    quantity: number;
    line_total_satang: number;
    product: { category: { id: string; name: string } };
    order_item_modifier: {
      modifier_option_id: string;
      name_snapshot: string;
      price_delta_satang: number;
    }[];
  }[];
  payment: {
    method: Method;
    amount_satang: number;
    tender_satang: number | null;
    change_satang: number | null;
    create_at: Date;
  }[];
};

export type ReportAuditInput = {
  action: 'VOID_ORDER' | 'REFUND_ORDER';
  entity_id: string | null;
  metadata: unknown;
  create_at: Date;
  staff: { id: string; name: string };
};

export type TenderLine = {
  method: Method;
  count: number;
  sales_satang: number;
  refunds_satang: number;
  net_satang: number;
};

export type AdjustmentLine = {
  order_id: string;
  order_number: number;
  amount_satang: number;
  // MIXED: a refund that went back as more than one method
  method: Method | 'MIXED' | null;
  staff_name: string | null;
  at: Date;
  reason: string | null;
};

export type ShiftReport = {
  session: {
    id: string;
    open_at: Date;
    close_at: Date | null;
    duration_minutes: number | null;
    opened_by: { id: string; name: string };
    closed_by: { id: string; name: string } | null;
    first_order_number: number | null;
    last_order_number: number | null;
  };
  summary: {
    gross_sales_satang: number;
    discounts_satang: number;
    refunds_satang: number;
    net_sales_satang: number;
    paid_orders: number;
    items_sold: number;
    avg_ticket_satang: number;
    // orders that came in as more than one tender
    split_orders: number;
  };
  tenders: TenderLine[];
  cash: {
    opening_float_satang: number;
    cash_sales_satang: number;
    cash_refunds_satang: number;
    expected_satang: number;
    counted_satang: number | null;
    variance_satang: number | null;
    tendered_satang: number;
    change_given_satang: number;
  };
  voids: { count: number; amount_satang: number; list: AdjustmentLine[] };
  refunds: { count: number; amount_satang: number; list: AdjustmentLine[] };
  items: {
    product_id: string;
    name: string;
    category_name: string;
    quantity: number;
    revenue_satang: number;
  }[];
  categories: {
    category_id: string;
    name: string;
    quantity: number;
    revenue_satang: number;
  }[];
  modifiers: {
    modifier_option_id: string;
    name: string;
    quantity: number;
    revenue_satang: number;
  }[];
  staff: {
    staff_id: string;
    name: string;
    paid_orders: number;
    net_sales_satang: number;
    voids: number;
    refunds: number;
  }[];
  // hour_start is the UTC hour (Bangkok is a whole-hour offset, the client formats it)
  hourly: { hour_start: Date; orders: number; net_sales_satang: number }[];
};

const METHODS: Method[] = ['CASH', 'PROMPTPAY'];
const HOUR_MS = 3_600_000;

const reasonOf = (metadata: unknown): string | null => {
  if (metadata && typeof metadata === 'object' && 'reason' in metadata) {
    const r = (metadata as { reason: unknown }).reason;
    return typeof r === 'string' ? r : null;
  }
  return null;
};

const byRevenue = <T extends { revenue_satang: number; quantity: number }>(
  a: T,
  b: T,
) => b.revenue_satang - a.revenue_satang || b.quantity - a.quantity;

export function buildShiftReport(
  session: ReportSessionInput,
  orders: ReportOrderInput[],
  audit: ReportAuditInput[],
): ShiftReport {
  const paid = orders.filter((o) => o.status === 'PAID');
  // money that came in at some point: still paid, or paid then refunded
  const sold = orders.filter(
    (o) => o.status === 'PAID' || o.status === 'REFUNDED',
  );
  const voided = orders.filter((o) => o.status === 'VOIDED');
  const refunded = orders.filter((o) => o.status === 'REFUNDED');

  const auditFor = (action: ReportAuditInput['action'], orderId: string) =>
    audit.find((a) => a.action === action && a.entity_id === orderId);

  // ── tenders ────────────────────────────────────────────────────────
  const tenders: TenderLine[] = METHODS.map((method) => {
    const rows = orders.flatMap((o) =>
      o.payment.filter((p) => p.method === method),
    );
    const sales = rows.filter((p) => p.amount_satang > 0);
    const refunds = rows.filter((p) => p.amount_satang < 0);
    const sales_satang = sales.reduce((t, p) => t + p.amount_satang, 0);
    const refunds_satang = refunds.reduce((t, p) => t - p.amount_satang, 0);
    return {
      method,
      count: sales.length,
      sales_satang,
      refunds_satang,
      net_satang: sales_satang - refunds_satang,
    };
  });
  const cashTender = tenders.find((t) => t.method === 'CASH')!;
  const cashSales = orders.flatMap((o) =>
    o.payment.filter((p) => p.method === 'CASH' && p.amount_satang > 0),
  );

  // ── summary ────────────────────────────────────────────────────────
  const gross = sold.reduce((t, o) => t + o.subtotal_satang, 0);
  const discounts = sold.reduce((t, o) => t + o.discount_satang, 0);
  const refundsTotal = tenders.reduce((t, l) => t + l.refunds_satang, 0);
  const net = gross - discounts - refundsTotal;
  const itemsSold = paid.reduce(
    (t, o) => t + o.order_item.reduce((s, i) => s + i.quantity, 0),
    0,
  );

  // ── items / categories / modifiers (what's still sold: PAID only) ──
  const items = new Map<string, ShiftReport['items'][number]>();
  const categories = new Map<string, ShiftReport['categories'][number]>();
  const modifiers = new Map<string, ShiftReport['modifiers'][number]>();
  for (const o of paid) {
    for (const i of o.order_item) {
      const cat = i.product.category;
      const item = items.get(i.product_id) ?? {
        product_id: i.product_id,
        name: i.product_name_snapshot,
        category_name: cat.name,
        quantity: 0,
        revenue_satang: 0,
      };
      item.quantity += i.quantity;
      item.revenue_satang += i.line_total_satang;
      items.set(i.product_id, item);

      const c = categories.get(cat.id) ?? {
        category_id: cat.id,
        name: cat.name,
        quantity: 0,
        revenue_satang: 0,
      };
      c.quantity += i.quantity;
      c.revenue_satang += i.line_total_satang;
      categories.set(cat.id, c);

      for (const m of i.order_item_modifier) {
        const mod = modifiers.get(m.modifier_option_id) ?? {
          modifier_option_id: m.modifier_option_id,
          name: m.name_snapshot,
          quantity: 0,
          revenue_satang: 0,
        };
        mod.quantity += i.quantity;
        mod.revenue_satang += m.price_delta_satang * i.quantity;
        modifiers.set(m.modifier_option_id, mod);
      }
    }
  }

  // ── staff (who rang the order up) ──────────────────────────────────
  const staff = new Map<string, ShiftReport['staff'][number]>();
  for (const o of orders) {
    const s = staff.get(o.staff.id) ?? {
      staff_id: o.staff.id,
      name: o.staff.name,
      paid_orders: 0,
      net_sales_satang: 0,
      voids: 0,
      refunds: 0,
    };
    if (o.status === 'PAID') {
      s.paid_orders += 1;
      s.net_sales_satang += o.total_satang;
    } else if (o.status === 'VOIDED') s.voids += 1;
    else if (o.status === 'REFUNDED') s.refunds += 1;
    staff.set(o.staff.id, s);
  }

  // ── hourly (by paid_at) ────────────────────────────────────────────
  const hourly = new Map<number, ShiftReport['hourly'][number]>();
  for (const o of paid) {
    if (!o.paid_at) continue;
    const h = Math.floor(o.paid_at.getTime() / HOUR_MS) * HOUR_MS;
    const b = hourly.get(h) ?? {
      hour_start: new Date(h),
      orders: 0,
      net_sales_satang: 0,
    };
    b.orders += 1;
    b.net_sales_satang += o.total_satang;
    hourly.set(h, b);
  }

  // ── voids & refunds ────────────────────────────────────────────────
  const voidList: AdjustmentLine[] = voided.map((o) => {
    const a = auditFor('VOID_ORDER', o.id);
    return {
      order_id: o.id,
      order_number: o.order_number,
      amount_satang: o.total_satang,
      method: null,
      staff_name: a?.staff.name ?? null,
      at: a?.create_at ?? o.create_at,
      reason: reasonOf(a?.metadata),
    };
  });
  const refundList: AdjustmentLine[] = refunded.map((o) => {
    const a = auditFor('REFUND_ORDER', o.id);
    const rows = o.payment.filter((p) => p.amount_satang < 0);
    const methods = [...new Set(rows.map((p) => p.method))];
    return {
      order_id: o.id,
      order_number: o.order_number,
      amount_satang: rows.length
        ? rows.reduce((t, p) => t - p.amount_satang, 0)
        : o.total_satang,
      method: methods.length > 1 ? 'MIXED' : (methods[0] ?? null),
      staff_name: a?.staff.name ?? null,
      at: a?.create_at ?? rows[0]?.create_at ?? o.create_at,
      reason: reasonOf(a?.metadata),
    };
  });

  // ── cash drawer ────────────────────────────────────────────────────
  // a closed session keeps the numbers it was closed with
  const expected =
    session.expect_cash_satang ??
    session.opening_float_satang + cashTender.net_satang;

  const numbers = orders.map((o) => o.order_number);

  return {
    session: {
      id: session.id,
      open_at: session.open_at,
      close_at: session.close_at,
      duration_minutes: session.close_at
        ? Math.round(
            (session.close_at.getTime() - session.open_at.getTime()) / 60_000,
          )
        : null,
      opened_by: session.opened_by_staff,
      closed_by: session.close_by_staff,
      first_order_number: numbers.length ? Math.min(...numbers) : null,
      last_order_number: numbers.length ? Math.max(...numbers) : null,
    },
    summary: {
      gross_sales_satang: gross,
      discounts_satang: discounts,
      refunds_satang: refundsTotal,
      net_sales_satang: net,
      paid_orders: paid.length,
      items_sold: itemsSold,
      avg_ticket_satang: paid.length ? Math.round(net / paid.length) : 0,
      split_orders: sold.filter(
        (o) => o.payment.filter((p) => p.amount_satang > 0).length > 1,
      ).length,
    },
    tenders,
    cash: {
      opening_float_satang: session.opening_float_satang,
      cash_sales_satang: cashTender.sales_satang,
      cash_refunds_satang: cashTender.refunds_satang,
      expected_satang: expected,
      counted_satang: session.counted_cash_satang,
      variance_satang: session.variance_satang,
      tendered_satang: cashSales.reduce((t, p) => t + (p.tender_satang ?? 0), 0),
      change_given_satang: cashSales.reduce(
        (t, p) => t + (p.change_satang ?? 0),
        0,
      ),
    },
    voids: {
      count: voidList.length,
      amount_satang: voidList.reduce((t, v) => t + v.amount_satang, 0),
      list: voidList,
    },
    refunds: {
      count: refundList.length,
      amount_satang: refundList.reduce((t, r) => t + r.amount_satang, 0),
      list: refundList,
    },
    items: [...items.values()].sort(byRevenue),
    categories: [...categories.values()].sort(byRevenue),
    modifiers: [...modifiers.values()].sort(byRevenue),
    staff: [...staff.values()].sort(
      (a, b) => b.net_sales_satang - a.net_sales_satang,
    ),
    hourly: [...hourly.values()].sort(
      (a, b) => a.hour_start.getTime() - b.hour_start.getTime(),
    ),
  };
}
