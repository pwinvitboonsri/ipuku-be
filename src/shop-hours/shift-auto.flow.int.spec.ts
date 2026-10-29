import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { LineClient } from '../line/line.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Role, Status } from '../generated/prisma/enums.js';
import { LoyaltyLedgerService } from '../loyalty/loyalty-ledger.service.js';
import { LoyaltyProgramService } from '../loyalty/loyalty-program.service.js';
import { LoyaltyOrderService } from '../loyalty/loyalty-order.service.js';
import { AUTO_VOID_REASON, ShiftAutoService } from './shift-auto.service.js';
import { ShopHoursService } from './shop-hours.service.js';

// Shifts that follow the shop's hours, against a real Postgres.
// Runs only with LOYALTY_TEST_DATABASE_URL set to a THROWAWAY database (it truncates tables).
const url = process.env.LOYALTY_TEST_DATABASE_URL;

// Thailand time → UTC instant
const bkk = (local: string) => new Date(`${local}+07:00`);

describe.skipIf(!url)('auto shifts (database)', () => {
  const config = { get: (k: string) => ({ 'database.url': url, 'line.enabled': false })[k] } as unknown as ConfigService;
  const prisma = new PrismaService(config);
  const program = new LoyaltyProgramService(prisma);
  const loyalty = new LoyaltyOrderService(prisma, config, {} as LineClient, new LoyaltyLedgerService(prisma), program);
  const auto = new ShiftAutoService(prisma, loyalty);
  const hours = new ShopHoursService(prisma, auto);
  let staffId = '';
  let productId = '';

  const order = (sessionId: string, status: Status, at: Date, n: number) =>
    prisma.order.create({
      data: {
        order_number: n,
        status,
        subtotal_satang: 8000,
        total_satang: 8000,
        client_order_id: crypto.randomUUID(),
        create_at: at,
        paid_at: status === Status.PAID ? at : null,
        cash_session_id: sessionId,
        staff_id: staffId,
        order_item: { create: { product_id: productId, product_name_snapshot: 'Latte', quantity: 1, unit_price_satang: 8000, line_total_satang: 8000 } },
      },
    });

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "SpecialDay","WeeklyHours","ShopSettings","PointsEntry","RewardCode","ClaimToken","Payment","OrderItemModifier","OrderItem","Order","CashSession","AuditLog","Product","Category","Staff" CASCADE',
    );
    staffId = (await prisma.staff.create({ data: { name: 'Nok', pin_hash: 'x', role: Role.OWNER } })).id;
    const cat = await prisma.category.create({ data: { name: 'Drinks', sort_order: 1 } });
    productId = (await prisma.product.create({ data: { name: 'Latte', price_satang: 8000, category_id: cat.id } })).id;
    // 10:00–18:00, Saturday off, from 1 Oct
    const days = Array.from({ length: 7 }, (_, i) => ({ open: i !== 6, open_min: 600, close_min: 1080 }));
    await hours.saveWeekly({ effective_from: '2026-10-01', days }, staffId, bkk('2026-09-30T12:00:00'));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('does nothing while auto shift is off', async () => {
    expect(await auto.current(bkk('2026-10-29T10:30:00'))).toBeNull();
    await hours.updateSettings({ auto_shift: true, auto_close_grace_minutes: 30 }, staffId);
  });

  it('opens on first use during hours, not before opening or on a day off', async () => {
    expect(await auto.current(bkk('2026-10-29T09:50:00'))).toBeNull();
    expect(await auto.current(bkk('2026-10-31T11:00:00'))).toBeNull(); // Saturday
    const s = await auto.current(bkk('2026-10-29T10:05:00'));
    expect(s).toMatchObject({ auto_opened: true, opened_by_staff_id: null, close_at: null });
    // a second request gets the same shift
    expect((await auto.current(bkk('2026-10-29T10:06:00')))?.id).toBe(s!.id);
  });

  it('closes after the grace at the scheduled time, voiding unpaid orders; running again changes nothing', async () => {
    const s = (await prisma.cashSession.findFirst({ where: { close_at: null } }))!;
    await order(s.id, Status.PAID, bkk('2026-10-29T12:00:00'), 1);
    const unpaid = await order(s.id, Status.OPEN, bkk('2026-10-29T17:50:00'), 2);

    expect(await auto.reconcile(bkk('2026-10-29T18:20:00'))).toBeNull(); // within grace
    const closed = await auto.reconcile(bkk('2026-10-29T18:31:00'));
    expect(closed).toMatchObject({ auto_closed: true, counted_cash_satang: null, variance_satang: null });
    expect(closed!.close_at!.toISOString()).toBe(bkk('2026-10-29T18:00:00').toISOString());
    expect((await prisma.order.findUniqueOrThrow({ where: { id: unpaid.id } })).status).toBe(Status.VOIDED);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity_id: unpaid.id } });
    expect(audit).toMatchObject({ staff_id: null, action: 'VOID_ORDER' });
    expect((audit.metadata as { reason: string }).reason).toBe(AUTO_VOID_REASON);

    expect(await auto.reconcile(bkk('2026-10-29T19:00:00'))).toBeNull();
    // after the grace nothing opens by itself
    expect(await auto.current(bkk('2026-10-29T18:45:00'))).toBeNull();
  });

  it('a shift opened by hand after closing (evening event) runs to midnight', async () => {
    const manual = await prisma.cashSession.create({ data: { opening_float_satang: 0, opened_by_staff_id: staffId, open_at: bkk('2026-10-29T19:30:00') } });
    expect(await auto.reconcile(bkk('2026-10-29T22:00:00'))).toBeNull();
    const closed = await auto.reconcile(bkk('2026-10-30T00:05:00'));
    expect(closed?.id).toBe(manual.id);
    expect(closed!.close_at!.toISOString()).toBe(bkk('2026-10-30T00:00:00').toISOString());
  });

  it('marking forgotten days off closed afterwards removes their empty auto shifts, keeps ones with sales', async () => {
    const empty = await prisma.cashSession.create({ data: { opening_float_satang: 0, auto_opened: true, auto_closed: true, open_at: bkk('2026-10-20T10:10:00'), close_at: bkk('2026-10-20T18:00:00') } });
    const withSale = await prisma.cashSession.create({ data: { opening_float_satang: 0, auto_opened: true, auto_closed: true, open_at: bkk('2026-10-21T10:10:00'), close_at: bkk('2026-10-21T18:00:00') } });
    await order(withSale.id, Status.PAID, bkk('2026-10-21T11:00:00'), 1);

    const res = await hours.createSpecial({ kind: 'CLOSED', from_date: '2026-10-19', to_date: '2026-10-22', note: 'Vacation' }, staffId, bkk('2026-10-29T12:00:00'));
    expect(res).toMatchObject({ removed: 1, kept_days_with_sales: ['2026-10-21'] });
    expect(await prisma.cashSession.findUnique({ where: { id: empty.id } })).toBeNull();
    expect(await prisma.cashSession.findUnique({ where: { id: withSale.id } })).not.toBeNull();

    const over = await hours.overview(bkk('2026-10-29T12:00:00'));
    expect(over.days.find((d) => d.date === '2026-10-20')).toMatchObject({ open: false, reason: 'SPECIAL', note: 'Vacation' });
  });

  it('weekly changes only from today on; an upcoming change can be removed', async () => {
    const now = bkk('2026-10-29T12:00:00');
    const days = Array.from({ length: 7 }, (_, i) => ({ open: i !== 0 && i !== 6, open_min: 480, close_min: 1020 }));
    await expect(hours.saveWeekly({ effective_from: '2026-10-28', days }, staffId, now)).rejects.toMatchObject({ status: 400 });
    const next = await hours.saveWeekly({ effective_from: '2026-11-01', days }, staffId, now);
    expect((await auto.plan('2026-11-01')).open).toBe(false); // Sunday is now a day off
    await hours.deleteWeekly(next.id, now);
    expect((await auto.plan('2026-11-01')).open).toBe(true);
  });
});
