import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuditAction, CouponSource, LoyaltyCurrency, RewardCodeStatus, StockMovementReason } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BASE_EARN_LABEL, type EarnLine } from '../loyalty/function/compute-earn.function.js';
import { DashboardQueryDTO } from './dto/dashboard-query.dto.js';
import { bkkDay, bkkMonth, cohortTable, daysBetween, fillDays, period, previousPeriod, type Period } from './function/dashboard.function.js';

const MAX_DAYS = 366;
const DAY_MS = 86_400_000;
// Thailand day / hour of a UTC timestamp column
const day = (col: Prisma.Sql) => Prisma.sql`to_char(${col} + interval '7 hours', 'YYYY-MM-DD')`;

const ZERO_DAY = {
  orders: 0,
  walk_orders: 0,
  grab_orders: 0,
  walk_sales_satang: 0,
  grab_sales_satang: 0,
  gross_satang: 0,
  discount_satang: 0,
  refunds: 0,
  refund_satang: 0,
  voids: 0,
  void_satang: 0,
  net_satang: 0,
  items: 0,
  cash_satang: 0,
  promptpay_satang: 0,
  grab_pay_satang: 0,
  claimed: 0,
  member_sales_satang: 0,
  new_members: 0,
  new_friends: 0,
  unfollows: 0,
  points_issued: 0,
  points_redeemed: 0,
  stamps_issued: 0,
  stamps_redeemed: 0,
  waste_entries: 0,
  grab_rejected: 0,
};
type DayRow = typeof ZERO_DAY;

const reasonOf = (metadata: unknown): string | null =>
  metadata && typeof metadata === 'object' && typeof (metadata as { reason?: unknown }).reason === 'string' ? (metadata as { reason: string }).reason : null;

// Back office dashboard: everything for one range and the range it's compared with, in one round trip.
// Sums run in SQL (grouped by Thailand day); member stats and cohorts are as of now.
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(dto: DashboardQueryDTO) {
    if (dto.to < dto.from || (dto.prev_from && dto.prev_to && dto.prev_to < dto.prev_from)) throw new BadRequestException('Range ends before it starts');
    if (daysBetween(dto.from, dto.to).length > MAX_DAYS) throw new BadRequestException(`A range can be at most ${MAX_DAYS} days`);
    if ((dto.prev_from == null) !== (dto.prev_to == null)) throw new BadRequestException('Give both prev_from and prev_to, or neither');

    const now = new Date();
    const cur = period(dto.from, dto.to);
    const prev = previousPeriod(cur, dto.prev_from, dto.prev_to, dto.prev_until ? new Date(dto.prev_until) : undefined);
    const lo = prev.start < cur.start ? prev.start : cur.start;
    const hi = prev.end > cur.end ? prev.end : cur.end;

    const [days, hours, products, productSeries, options, staff, events, shifts, waste, rewards, coupons, earn, snapshot, members, cohorts, program] = await Promise.all([
      this.days(lo, hi, [cur, prev]),
      this.hours(lo, hi),
      this.products(cur, prev),
      this.productSeries(cur, prev),
      this.options(cur),
      this.staff(cur),
      this.events(cur),
      this.shifts(cur),
      this.waste(cur),
      this.rewards(cur),
      this.coupons(cur, now),
      this.earn(cur),
      this.snapshot(cur, prev),
      this.members(now),
      this.cohorts(now),
      this.prisma.loyaltyProgram.findUnique({ where: { id: 1 }, select: { points_per_unit: true, unit_satang: true } }),
    ]);

    return {
      range: { from: cur.from, to: cur.to, prev_from: prev.from, prev_to: prev.to, prev_until: prev.end.toISOString() },
      now: now.toISOString(),
      program: program ?? { points_per_unit: 1, unit_satang: 1000 },
      loyalty_since: members.reduce<string | null>((a, m) => (a == null || m.joined_at < a ? m.joined_at : a), null),
      days,
      hours,
      products,
      product_series: productSeries,
      options,
      staff,
      events,
      shifts,
      waste,
      ...rewards,
      coupons,
      ...earn,
      ...snapshot,
      members,
      cohorts,
    };
  }

  // ── per-day series over both ranges ───────────────────────────────
  private async days(lo: Date, hi: Date, periods: Period[]) {
    const rows = new Map<string, Partial<DayRow>>();
    const put = (list: ({ d: string } & Partial<DayRow>)[]) =>
      list.forEach(({ d, ...v }) => {
        const r = rows.get(d) ?? {};
        for (const [k, n] of Object.entries(v)) r[k as keyof DayRow] = Number(n ?? 0);
        rows.set(d, r);
      });

    const db = this.prisma;
    const [orders, items, pays, refunds, voids, members, follows, unfollows, points, waste, grab] = await Promise.all([
      // money that came in: PAID, or paid and later refunded (the refund is its own line below)
      db.$queryRaw<({ d: string } & Partial<DayRow>)[]>`
        SELECT ${day(Prisma.sql`o.paid_at`)} AS d,
          count(*) FILTER (WHERE o.status = 'PAID')::int AS orders,
          count(*) FILTER (WHERE o.status = 'PAID' AND o.channel = 'WALK_IN')::int AS walk_orders,
          count(*) FILTER (WHERE o.status = 'PAID' AND o.channel = 'GRAB')::int AS grab_orders,
          coalesce(sum(o.total_satang) FILTER (WHERE o.status = 'PAID' AND o.channel = 'WALK_IN'), 0)::float8 AS walk_sales_satang,
          coalesce(sum(o.total_satang) FILTER (WHERE o.status = 'PAID' AND o.channel = 'GRAB'), 0)::float8 AS grab_sales_satang,
          coalesce(sum(o.subtotal_satang), 0)::float8 AS gross_satang,
          coalesce(sum(o.discount_satang), 0)::float8 AS discount_satang,
          count(ct.id) FILTER (WHERE o.status = 'PAID' AND ct.claimed_at IS NOT NULL)::int AS claimed,
          coalesce(sum(o.total_satang) FILTER (WHERE o.status = 'PAID' AND ct.claimed_at IS NOT NULL), 0)::float8 AS member_sales_satang
        FROM "Order" o LEFT JOIN "ClaimToken" ct ON ct.order_id = o.id
        WHERE o.status IN ('PAID', 'REFUNDED') AND o.paid_at >= ${lo} AND o.paid_at < ${hi}
        GROUP BY 1`,
      db.$queryRaw<{ d: string; items: number }[]>`
        SELECT ${day(Prisma.sql`o.paid_at`)} AS d, coalesce(sum(oi.quantity), 0)::int AS items
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi.order_id
        WHERE o.status = 'PAID' AND o.paid_at >= ${lo} AND o.paid_at < ${hi}
        GROUP BY 1`,
      db.$queryRaw<{ d: string; cash_satang: number; promptpay_satang: number; grab_pay_satang: number }[]>`
        SELECT ${day(Prisma.sql`p.create_at`)} AS d,
          coalesce(sum(p.amount_satang) FILTER (WHERE p.method = 'CASH'), 0)::float8 AS cash_satang,
          coalesce(sum(p.amount_satang) FILTER (WHERE p.method = 'PROMPTPAY'), 0)::float8 AS promptpay_satang,
          coalesce(sum(p.amount_satang) FILTER (WHERE p.method = 'GRAB'), 0)::float8 AS grab_pay_satang
        FROM "Payment" p WHERE p.create_at >= ${lo} AND p.create_at < ${hi}
        GROUP BY 1`,
      db.$queryRaw<{ d: string; refunds: number; refund_satang: number }[]>`
        SELECT ${day(Prisma.sql`p.create_at`)} AS d, count(DISTINCT p.order_id)::int AS refunds, coalesce(-sum(p.amount_satang), 0)::float8 AS refund_satang
        FROM "Payment" p WHERE p.amount_satang < 0 AND p.create_at >= ${lo} AND p.create_at < ${hi}
        GROUP BY 1`,
      db.$queryRaw<{ d: string; voids: number; void_satang: number }[]>`
        SELECT ${day(Prisma.sql`a.create_at`)} AS d, count(*)::int AS voids, coalesce(sum(o.total_satang), 0)::float8 AS void_satang
        FROM "AuditLog" a JOIN "Order" o ON o.id = a.entity_id
        WHERE a.action = 'VOID_ORDER' AND a.create_at >= ${lo} AND a.create_at < ${hi}
        GROUP BY 1`,
      db.$queryRaw<{ d: string; new_members: number }[]>`
        SELECT ${day(Prisma.sql`create_at`)} AS d, count(*)::int AS new_members FROM "Member"
        WHERE create_at >= ${lo} AND create_at < ${hi} GROUP BY 1`,
      db.$queryRaw<{ d: string; new_friends: number }[]>`
        SELECT ${day(Prisma.sql`followed_at`)} AS d, count(*)::int AS new_friends FROM "LineContact"
        WHERE followed_at >= ${lo} AND followed_at < ${hi} GROUP BY 1`,
      db.$queryRaw<{ d: string; unfollows: number }[]>`
        SELECT ${day(Prisma.sql`unfollowed_at`)} AS d, count(*)::int AS unfollows FROM "LineContact"
        WHERE unfollowed_at >= ${lo} AND unfollowed_at < ${hi} GROUP BY 1`,
      db.$queryRaw<{ d: string; points_issued: number; points_redeemed: number; stamps_issued: number; stamps_redeemed: number }[]>`
        SELECT ${day(Prisma.sql`create_at`)} AS d,
          coalesce(sum(points) FILTER (WHERE currency = 'POINTS' AND type IN ('EARN', 'BONUS')), 0)::float8 AS points_issued,
          coalesce(-sum(points) FILTER (WHERE currency = 'POINTS' AND type = 'REDEEM'), 0)::float8 AS points_redeemed,
          coalesce(sum(points) FILTER (WHERE currency = 'STAMPS' AND type IN ('EARN', 'BONUS')), 0)::float8 AS stamps_issued,
          coalesce(-sum(points) FILTER (WHERE currency = 'STAMPS' AND type = 'REDEEM'), 0)::float8 AS stamps_redeemed
        FROM "PointsEntry" WHERE create_at >= ${lo} AND create_at < ${hi} GROUP BY 1`,
      db.$queryRaw<{ d: string; waste_entries: number }[]>`
        SELECT ${day(Prisma.sql`create_at`)} AS d, count(*)::int AS waste_entries FROM "StockMovement"
        WHERE reason = 'WASTE' AND create_at >= ${lo} AND create_at < ${hi} GROUP BY 1`,
      db.$queryRaw<{ d: string; grab_rejected: number }[]>`
        SELECT ${day(Prisma.sql`create_at`)} AS d, count(*)::int AS grab_rejected FROM "GrabOrder"
        WHERE rejected_reason IS NOT NULL AND create_at >= ${lo} AND create_at < ${hi} GROUP BY 1`,
    ]);
    [orders, items, pays, refunds, voids, members, follows, unfollows, points, waste, grab].forEach((l) => put(l as ({ d: string } & Partial<DayRow>)[]));

    return fillDays(periods, ZERO_DAY, rows).map((d) => ({ ...d, net_satang: d.gross_satang - d.discount_satang - d.refund_satang }));
  }

  // paid orders by Thailand day and hour, for the heatmap and the single-day chart
  private hours(lo: Date, hi: Date) {
    return this.prisma.$queryRaw<{ date: string; hour: number; orders: number; net_satang: number }[]>`
      SELECT ${day(Prisma.sql`paid_at`)} AS date, extract(hour FROM paid_at + interval '7 hours')::int AS hour,
        count(*)::int AS orders, coalesce(sum(total_satang), 0)::float8 AS net_satang
      FROM "Order" WHERE status = 'PAID' AND paid_at >= ${lo} AND paid_at < ${hi}
      GROUP BY 1, 2 ORDER BY 1, 2`;
  }

  private async products(cur: Period, prev: Period) {
    const rows = await this.prisma.$queryRaw<{ product_id: string; cur: boolean; quantity: number; revenue_satang: number }[]>`
      SELECT oi.product_id, (o.paid_at >= ${cur.start} AND o.paid_at < ${cur.end}) AS cur,
        sum(oi.quantity)::int AS quantity, sum(oi.line_total_satang)::float8 AS revenue_satang
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi.order_id
      WHERE o.status = 'PAID' AND ((o.paid_at >= ${cur.start} AND o.paid_at < ${cur.end}) OR (o.paid_at >= ${prev.start} AND o.paid_at < ${prev.end}))
      GROUP BY 1, 2`;
    const meta = await this.prisma.product.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.product_id))] } },
      select: { id: true, name: true, image_url: true, category: { select: { id: true, name: true } } },
    });
    return meta
      .map((p) => {
        const c = rows.find((r) => r.product_id === p.id && r.cur);
        const pr = rows.find((r) => r.product_id === p.id && !r.cur);
        return {
          product_id: p.id,
          name: p.name,
          image_url: p.image_url,
          category_id: p.category.id,
          category_name: p.category.name,
          quantity: c?.quantity ?? 0,
          revenue_satang: c?.revenue_satang ?? 0,
          prev_quantity: pr?.quantity ?? 0,
          prev_revenue_satang: pr?.revenue_satang ?? 0,
        };
      })
      .sort((a, b) => b.revenue_satang - a.revenue_satang);
  }

  // units sold per product per day of both ranges (per hour too when the range is one day), for the product trend
  private productSeries(cur: Period, prev: Period) {
    const hourly = cur.from === cur.to;
    const hour = hourly ? Prisma.sql`extract(hour FROM o.paid_at + interval '7 hours')::int` : Prisma.sql`NULL::int`;
    return this.prisma.$queryRaw<{ product_id: string; date: string; hour: number | null; quantity: number }[]>`
      SELECT oi.product_id, ${day(Prisma.sql`o.paid_at`)} AS date, ${hour} AS hour, sum(oi.quantity)::int AS quantity
      FROM "OrderItem" oi JOIN "Order" o ON o.id = oi.order_id
      WHERE o.status = 'PAID' AND ((o.paid_at >= ${cur.start} AND o.paid_at < ${cur.end}) OR (o.paid_at >= ${prev.start} AND o.paid_at < ${prev.end}))
      GROUP BY 1, 2, 3`;
  }

  // how often an option is picked out of the items that could have it (products linked to its group)
  private async options(cur: Period) {
    const [picked, base] = await Promise.all([
      this.prisma.$queryRaw<{ modifier_option_id: string; picked: number; revenue_satang: number }[]>`
        SELECT m.modifier_option_id, sum(oi.quantity)::int AS picked, sum(m.price_delta_satang * oi.quantity)::float8 AS revenue_satang
        FROM "OrderItemModifier" m JOIN "OrderItem" oi ON oi.id = m.order_item_id JOIN "Order" o ON o.id = oi.order_id
        WHERE o.status = 'PAID' AND o.paid_at >= ${cur.start} AND o.paid_at < ${cur.end}
        GROUP BY 1`,
      this.prisma.$queryRaw<{ group_id: string; base: number }[]>`
        SELECT pmg.modifier_group_id AS group_id, sum(oi.quantity)::int AS base
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi.order_id JOIN "ProductModifierGroup" pmg ON pmg.product_id = oi.product_id
        WHERE o.status = 'PAID' AND o.paid_at >= ${cur.start} AND o.paid_at < ${cur.end}
        GROUP BY 1`,
    ]);
    const meta = await this.prisma.modifierOption.findMany({
      where: { id: { in: picked.map((p) => p.modifier_option_id) } },
      select: { id: true, name: true, price_delta_satang: true, modifier_group: { select: { id: true, name: true } } },
    });
    return meta
      .map((o) => {
        const p = picked.find((x) => x.modifier_option_id === o.id)!;
        const b = base.find((x) => x.group_id === o.modifier_group.id)?.base ?? 0;
        return {
          modifier_option_id: o.id,
          name: o.name,
          group_name: o.modifier_group.name,
          price_delta_satang: o.price_delta_satang,
          picked: p.picked,
          base: Math.max(b, p.picked),
          revenue_satang: p.revenue_satang,
        };
      })
      .sort((a, b) => b.picked - a.picked);
  }

  // who rang up the paid orders; voids and refunds by who did them
  private async staff(cur: Period) {
    const [sales, adj] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['staff_id'],
        where: { status: 'PAID', paid_at: { gte: cur.start, lt: cur.end } },
        _count: { _all: true },
        _sum: { total_satang: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['staff_id', 'action'],
        where: { action: { in: [AuditAction.VOID_ORDER, AuditAction.REFUND_ORDER] }, create_at: { gte: cur.start, lt: cur.end } },
        _count: { _all: true },
      }),
    ]);
    const ids = [...new Set([...sales.map((s) => s.staff_id), ...adj.map((a) => a.staff_id)])];
    const people = await this.prisma.staff.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: true } });
    return people
      .map((p) => {
        const s = sales.find((x) => x.staff_id === p.id);
        const n = (action: AuditAction) => adj.find((a) => a.staff_id === p.id && a.action === action)?._count._all ?? 0;
        return {
          staff_id: p.id,
          name: p.name,
          role: p.role,
          paid_orders: s?._count._all ?? 0,
          net_sales_satang: s?._sum.total_satang ?? 0,
          voids: n(AuditAction.VOID_ORDER),
          refunds: n(AuditAction.REFUND_ORDER),
        };
      })
      .sort((a, b) => b.net_sales_satang - a.net_sales_satang);
  }

  // voids and refunds in the range, newest first (reasons only live in the audit log)
  private async events(cur: Period) {
    const audit = await this.prisma.auditLog.findMany({
      where: { action: { in: [AuditAction.VOID_ORDER, AuditAction.REFUND_ORDER] }, entity_type: 'Order', create_at: { gte: cur.start, lt: cur.end } },
      select: { action: true, entity_id: true, metadata: true, create_at: true, staff: { select: { name: true } } },
      orderBy: { create_at: 'desc' },
      take: 200,
    });
    const orders = await this.prisma.order.findMany({
      where: { id: { in: audit.map((a) => a.entity_id).filter((x): x is string => !!x) } },
      select: { id: true, order_number: true, total_satang: true, payment: { where: { amount_satang: { lt: 0 } }, select: { amount_satang: true } } },
    });
    return audit.map((a) => {
      const o = orders.find((x) => x.id === a.entity_id);
      const refunded = o?.payment.reduce((t, p) => t - p.amount_satang, 0) ?? 0;
      return {
        kind: a.action === AuditAction.REFUND_ORDER ? ('REFUND' as const) : ('VOID' as const),
        order_id: a.entity_id,
        order_number: o?.order_number ?? null,
        amount_satang: a.action === AuditAction.REFUND_ORDER && refunded ? refunded : (o?.total_satang ?? 0),
        staff_name: a.staff.name,
        at: a.create_at,
        reason: reasonOf(a.metadata),
      };
    });
  }

  private shifts(cur: Period) {
    return this.prisma.cashSession.findMany({
      where: { close_at: { gte: cur.start, lt: cur.end } },
      select: { id: true, open_at: true, close_at: true, variance_satang: true, close_by_staff: { select: { name: true } } },
      orderBy: { close_at: 'asc' },
    });
  }

  private async waste(cur: Period) {
    const rows = await this.prisma.stockMovement.groupBy({
      by: ['ingredient_id'],
      where: { reason: StockMovementReason.WASTE, create_at: { gte: cur.start, lt: cur.end } },
      _count: { _all: true },
      _sum: { change_quantity: true },
    });
    const meta = await this.prisma.ingredient.findMany({ where: { id: { in: rows.map((r) => r.ingredient_id) } }, select: { id: true, name: true, unit: true } });
    return rows
      .map((r) => {
        const i = meta.find((m) => m.id === r.ingredient_id);
        return { ingredient_id: r.ingredient_id, name: i?.name ?? '—', unit: i?.unit ?? '', entries: r._count._all, quantity: Math.abs(r._sum.change_quantity ?? 0) };
      })
      .sort((a, b) => b.entries - a.entries || b.quantity - a.quantity);
  }

  // rewards used at the counter (points codes and wallet coupons)
  private async rewards(cur: Period) {
    const used = await this.prisma.rewardCode.findMany({
      where: { status: RewardCodeStatus.USED, used_at: { gte: cur.start, lt: cur.end } },
      select: { reward_id: true, discount_satang: true, coupon_id: true },
    });
    const meta = await this.prisma.reward.findMany({
      where: { id: { in: [...new Set(used.map((u) => u.reward_id))] } },
      select: { id: true, name: true, type: true, cost_points: true, cost_currency: true, image_url: true },
    });
    const sum = (l: typeof used) => l.reduce((t, u) => t + (u.discount_satang ?? 0), 0);
    return {
      reward_discount_satang: sum(used.filter((u) => !u.coupon_id)),
      coupon_discount_satang: sum(used.filter((u) => u.coupon_id)),
      rewards: meta
        .map((r) => {
          const mine = used.filter((u) => u.reward_id === r.id);
          return { reward_id: r.id, name: r.name, type: r.type, cost_points: r.cost_points, cost_currency: r.cost_currency, image_url: r.image_url, redemptions: mine.length, discount_satang: sum(mine) };
        })
        .sort((a, b) => b.redemptions - a.redemptions),
    };
  }

  // coupons issued in the range and what became of them
  private async coupons(cur: Period, now: Date) {
    const rows = await this.prisma.memberCoupon.findMany({
      where: { create_at: { gte: cur.start, lt: cur.end } },
      select: { source: true, used_at: true, valid_until: true },
    });
    return Object.values(CouponSource).map((source) => {
      const mine = rows.filter((r) => r.source === source);
      const used = mine.filter((r) => r.used_at).length;
      const expired = mine.filter((r) => !r.used_at && r.valid_until <= now).length;
      return { source, issued: mine.length, used, expired, open: mine.length - used - expired };
    });
  }

  // extra points/stamps each earn rule gave on claimed receipts (the base points line is left out)
  private async earn(cur: Period) {
    const [tokens, rules] = await Promise.all([
      this.prisma.claimToken.findMany({ where: { claimed_at: { gte: cur.start, lt: cur.end } }, select: { lines: true } }),
      this.prisma.earnRule.findMany({ select: { name: true, kind: true, is_active: true, weekdays: true, time_from: true, time_to: true } }),
    ]);
    const by = new Map<string, { label: string; points: number; stamps: number; receipts: number }>();
    for (const t of tokens) {
      for (const l of (Array.isArray(t.lines) ? t.lines : []) as unknown as EarnLine[]) {
        if (!l || l.label === BASE_EARN_LABEL) continue;
        const r = by.get(l.label) ?? { label: l.label, points: 0, stamps: 0, receipts: 0 };
        r.points += l.points ?? 0;
        r.stamps += l.stamps ?? 0;
        r.receipts += 1;
        by.set(l.label, r);
      }
    }
    return { earn_lines: [...by.values()].sort((a, b) => b.points + b.stamps - (a.points + a.stamps)), earn_rules: rules };
  }

  // totals at the end of each range: friends, members, points and stamps members hold
  private async snapshot(cur: Period, prev: Period) {
    const friendsAt = (t: Date) => this.prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "LineContact"
      WHERE coalesce(followed_at, create_at) < ${t} AND (is_friend OR unfollowed_at >= ${t})`;
    const [fc, fp, mc, mp, bal] = await Promise.all([
      friendsAt(cur.end),
      friendsAt(prev.end),
      this.prisma.member.count({ where: { create_at: { lt: cur.end } } }),
      this.prisma.member.count({ where: { create_at: { lt: prev.end } } }),
      this.prisma.pointsEntry.groupBy({ by: ['currency'], where: { create_at: { lt: cur.end } }, _sum: { points: true } }),
    ]);
    const held = (c: LoyaltyCurrency) => bal.find((b) => b.currency === c)?._sum.points ?? 0;
    return {
      friends: fc[0]?.n ?? 0,
      prev_friends: fp[0]?.n ?? 0,
      members_total: mc,
      prev_members_total: mp,
      points_outstanding: held(LoyaltyCurrency.POINTS),
      stamps_outstanding: held(LoyaltyCurrency.STAMPS),
    };
  }

  // every member with visits (claimed receipts of paid orders), spend, balances and this year's birthday coupon
  private async members(now: Date) {
    const since30 = new Date(now.getTime() - 30 * DAY_MS);
    const year = bkkDay(now).slice(0, 4);
    const [list, visits, balances, bdays] = await Promise.all([
      this.prisma.member.findMany({ select: { id: true, member_no: true, display_name: true, picture_url: true, birth_day: true, birth_month: true, create_at: true } }),
      this.prisma.$queryRaw<{ member_id: string; visits: number; spend_satang: number; first_visit: Date; last_visit: Date; visits_30d: number }[]>`
        SELECT ct.member_id, count(*)::int AS visits, sum(o.total_satang)::float8 AS spend_satang,
          min(o.paid_at) AS first_visit, max(o.paid_at) AS last_visit,
          count(*) FILTER (WHERE o.paid_at >= ${since30})::int AS visits_30d
        FROM "ClaimToken" ct JOIN "Order" o ON o.id = ct.order_id
        WHERE ct.member_id IS NOT NULL AND o.status = 'PAID'
        GROUP BY 1`,
      this.prisma.pointsEntry.groupBy({ by: ['member_id', 'currency'], _sum: { points: true } }),
      this.prisma.memberCoupon.findMany({
        where: { source: CouponSource.BIRTHDAY, create_at: { gte: new Date(`${year}-01-01T00:00:00+07:00`) } },
        select: { member_id: true, used_at: true, valid_until: true },
      }),
    ]);
    return list
      .map((m) => {
        const v = visits.find((x) => x.member_id === m.id);
        const bal = (c: LoyaltyCurrency) => balances.find((b) => b.member_id === m.id && b.currency === c)?._sum.points ?? 0;
        const coupon = bdays.find((b) => b.member_id === m.id);
        return {
          id: m.id,
          member_no: m.member_no,
          display_name: m.display_name,
          picture_url: m.picture_url,
          joined_at: m.create_at.toISOString(),
          visits: v?.visits ?? 0,
          visits_30d: v?.visits_30d ?? 0,
          spend_satang: v?.spend_satang ?? 0,
          first_visit: v?.first_visit ?? null,
          last_visit: v?.last_visit ?? null,
          points: bal(LoyaltyCurrency.POINTS),
          stamps: bal(LoyaltyCurrency.STAMPS),
          birth_day: m.birth_day,
          birth_month: m.birth_month,
          birthday_coupon: !coupon ? null : coupon.used_at ? ('USED' as const) : coupon.valid_until <= now ? ('EXPIRED' as const) : ('OPEN' as const),
        };
      })
      .sort((a, b) => b.spend_satang - a.spend_satang);
  }

  private async cohorts(now: Date) {
    const [joined, visits] = await Promise.all([
      this.prisma.$queryRaw<{ month: string; members: number }[]>`
        SELECT to_char(create_at + interval '7 hours', 'YYYY-MM') AS month, count(*)::int AS members FROM "Member" GROUP BY 1`,
      this.prisma.$queryRaw<{ cohort: string; month: string; members: number }[]>`
        SELECT to_char(m.create_at + interval '7 hours', 'YYYY-MM') AS cohort, to_char(o.paid_at + interval '7 hours', 'YYYY-MM') AS month,
          count(DISTINCT m.id)::int AS members
        FROM "Member" m JOIN "ClaimToken" ct ON ct.member_id = m.id JOIN "Order" o ON o.id = ct.order_id
        WHERE o.status = 'PAID'
        GROUP BY 1, 2`,
    ]);
    return cohortTable(joined, visits, bkkMonth(now));
  }
}
