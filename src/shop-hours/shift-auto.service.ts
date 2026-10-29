import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuditAction, PaymentType, Status } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoyaltyOrderService } from '../loyalty/loyalty-order.service.js';
import { addDays, bkkDay } from '../common/time/bkk-time.function.js';
import { autoCloseAt, canAutoOpen, dayPlan, type SpecialRow, type WeeklyRow } from './function/schedule.function.js';

export const AUTO_VOID_REASON = 'Shift auto-closed · not paid';
// one key for every shift open/close so two requests can't both open or close
const SHIFT_LOCK = 0x5ef7;

// Shifts that follow the shop's hours. Render's free plan sleeps, so nothing runs on the minute:
// every shift-related request (and the hourly job) catches up. A shift closed by the schedule
// gets the scheduled closing time, not the time this ran.
@Injectable()
export class ShiftAutoService {
  private readonly logger = new Logger(ShiftAutoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly loyalty: LoyaltyOrderService,
  ) {}

  async settings(db: Prisma.TransactionClient = this.prisma) {
    return (await db.shopSettings.findUnique({ where: { id: 1 } })) ?? { id: 1, auto_shift: false, auto_close_grace_minutes: 30, default_float_satang: 0, update_at: new Date(0), update_by_staff_id: null };
  }

  /// weekly rows and the special days touching [from, to]
  async schedule(from: string, to: string, db: Prisma.TransactionClient = this.prisma): Promise<{ weekly: WeeklyRow[]; specials: SpecialRow[] }> {
    const [weekly, specials] = await Promise.all([
      db.weeklyHours.findMany({ orderBy: { effective_from: 'asc' } }),
      db.specialDay.findMany({ where: { from_date: { lte: to }, to_date: { gte: from } } }),
    ]);
    return { weekly: weekly.map((w) => ({ effective_from: w.effective_from, days: w.days as unknown as WeeklyRow['days'] })), specials };
  }

  async plan(date: string, db: Prisma.TransactionClient = this.prisma) {
    const { weekly, specials } = await this.schedule(date, date, db);
    return dayPlan(date, weekly, specials);
  }

  /// Close the open shift if its day's closing time (+ grace) has passed. Only when auto shift is on.
  async reconcile(now = new Date()) {
    const s = await this.settings();
    if (!s.auto_shift) return null;
    const open = await this.prisma.cashSession.findFirst({ where: { close_at: null }, select: { id: true, open_at: true } });
    if (!open) return null;
    const { scheduled, deadline } = autoCloseAt(await this.plan(bkkDay(open.open_at)), s.auto_close_grace_minutes, open.open_at);
    if (now < deadline) return null;
    return await this.closeAuto(open.id, scheduled);
  }

  /// Open a shift on first use during opening hours (POS opened, an order rung up, a Grab order in)
  async ensureOpen(now = new Date()) {
    const s = await this.settings();
    if (!s.auto_shift) return null;
    const plan = await this.plan(bkkDay(now));
    if (!canAutoOpen(plan, now, s.auto_close_grace_minutes)) return null;
    return await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SHIFT_LOCK})`;
      const existing = await tx.cashSession.findFirst({ where: { close_at: null } });
      if (existing) return existing;
      return await tx.cashSession.create({ data: { opening_float_satang: s.default_float_satang, auto_opened: true } });
    });
  }

  /// Catch up, then the shift to sell in (null = none; outside hours staff open one by hand)
  async current(now = new Date()) {
    await this.reconcile(now);
    return (await this.ensureOpen(now)) ?? (await this.prisma.cashSession.findFirst({ where: { close_at: null } }));
  }

  // Unpaid orders are voided (a LINE reward on them goes back to the customer), then the shift closes
  // at the scheduled time — or its last order, if later. No cash count: variance stays empty.
  private async closeAuto(sessionId: string, scheduled: Date) {
    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SHIFT_LOCK})`;
      const session = await tx.cashSession.findUnique({ where: { id: sessionId } });
      if (!session || session.close_at) return null;

      const unpaid = await tx.order.findMany({ where: { cash_session_id: sessionId, status: Status.OPEN }, select: { id: true, order_number: true } });
      for (const o of unpaid) {
        await this.loyalty.releaseInTx(tx, o.id);
        await tx.order.update({ where: { id: o.id }, data: { status: Status.VOIDED } });
        await tx.auditLog.create({
          data: { staff_id: null, action: AuditAction.VOID_ORDER, entity_type: 'Order', entity_id: o.id, metadata: { reason: AUTO_VOID_REASON, order_number: o.order_number, auto: true } },
        });
      }

      const last = await tx.order.aggregate({ where: { cash_session_id: sessionId }, _max: { create_at: true, paid_at: true } });
      const lastAt = Math.max(last._max.create_at?.getTime() ?? 0, last._max.paid_at?.getTime() ?? 0);
      const cash = await tx.payment.aggregate({ where: { method: PaymentType.CASH, order: { cash_session_id: sessionId } }, _sum: { amount_satang: true } });

      return await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          close_at: new Date(Math.max(scheduled.getTime(), lastAt, session.open_at.getTime())),
          expect_cash_satang: session.opening_float_satang + (cash._sum.amount_satang ?? 0),
          counted_cash_satang: null,
          variance_satang: null,
          auto_closed: true,
        },
      });
    });
    if (closed) this.logger.log(`Shift ${closed.id} closed by the schedule at ${closed.close_at?.toISOString()}`);
    return closed;
  }

  /// Days marked closed afterwards: their auto-opened shifts with no orders never happened
  async dropEmptyAutoShifts(from: string, to: string) {
    const start = new Date(`${from}T00:00:00+07:00`);
    const end = new Date(`${addDays(to, 1)}T00:00:00+07:00`);
    const sessions = await this.prisma.cashSession.findMany({
      where: { auto_opened: true, open_at: { gte: start, lt: end }, close_at: { not: null } },
      select: { id: true, open_at: true, _count: { select: { order: true } } },
    });
    const empty = sessions.filter((s) => s._count.order === 0).map((s) => s.id);
    if (empty.length) await this.prisma.cashSession.deleteMany({ where: { id: { in: empty } } });
    const kept = sessions.filter((s) => s._count.order > 0).map((s) => bkkDay(s.open_at));
    return { removed: empty.length, kept_days_with_sales: [...new Set(kept)] };
  }
}
