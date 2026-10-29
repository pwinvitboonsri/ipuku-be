import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { SpecialDayKind } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { addDays, bkkDay } from '../common/time/bkk-time.function.js';
import { plans, validDays } from './function/schedule.function.js';
import { ShiftAutoService } from './shift-auto.service.js';
import { ShopSettingsDTO, SpecialDayDTO, WeeklyHoursDTO } from './dto/shop-hours.dto.js';

const AHEAD = 14; // days of plan shown ahead
const BACK = 14; // past days shown, so a forgotten day off can be marked closed

// Back office → Opening hours: weekly pattern (changes from a date), special days, shift automation
@Injectable()
export class ShopHoursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auto: ShiftAutoService,
  ) {}

  async overview(now = new Date()) {
    const today = bkkDay(now);
    const from = addDays(today, -BACK);
    const to = addDays(today, AHEAD - 1);
    const [settings, weekly, specials, sched] = await Promise.all([
      this.auto.settings(),
      this.prisma.weeklyHours.findMany({ orderBy: { effective_from: 'asc' } }),
      this.prisma.specialDay.findMany({ orderBy: [{ from_date: 'desc' }] }),
      this.auto.schedule(from, to),
    ]);
    // sales per day in the past window (a day with sales can't quietly become "closed")
    const sales = await this.prisma.$queryRaw<{ d: string; orders: number }[]>`
      SELECT to_char(o.create_at + interval '7 hours', 'YYYY-MM-DD') AS d, count(*)::int AS orders
      FROM "Order" o WHERE o.status <> 'VOIDED' AND o.create_at >= ${new Date(`${from}T00:00:00+07:00`)} AND o.create_at < ${new Date(`${today}T00:00:00+07:00`)}
      GROUP BY 1`;
    const inForce = weekly.filter((w) => w.effective_from <= today).at(-1)?.id ?? null;
    return {
      today,
      settings,
      weekly: weekly.map((w) => ({ ...w, in_force: w.id === inForce, upcoming: w.effective_from > today })),
      specials,
      days: plans(from, to, sched.weekly, sched.specials).map((p) => ({ ...p, orders: sales.find((s) => s.d === p.date)?.orders ?? 0, past: p.date < today })),
    };
  }

  async today(now = new Date()) {
    const s = await this.auto.settings();
    return { auto_shift: s.auto_shift, grace_minutes: s.auto_close_grace_minutes, default_float_satang: s.default_float_satang, plan: await this.auto.plan(bkkDay(now)) };
  }

  async updateSettings(dto: ShopSettingsDTO, staffId: string) {
    return this.prisma.shopSettings.upsert({ where: { id: 1 }, create: { id: 1, ...dto, update_by_staff_id: staffId }, update: { ...dto, update_by_staff_id: staffId } });
  }

  // a week starting today or later; the same start date replaces that row (past weeks stay as they were)
  async saveWeekly(dto: WeeklyHoursDTO, staffId: string, now = new Date()) {
    if (!validDays(dto.days)) throw new BadRequestException('Give 7 days (Sunday first), each closing after it opens');
    if (dto.effective_from < bkkDay(now)) throw new BadRequestException("Hours can't change in the past — mark past days with a special day instead");
    const days = dto.days as unknown as Prisma.InputJsonValue;
    return this.prisma.weeklyHours.upsert({
      where: { effective_from: dto.effective_from },
      create: { effective_from: dto.effective_from, days, update_by_staff_id: staffId },
      update: { days, update_by_staff_id: staffId },
    });
  }

  async deleteWeekly(id: string, now = new Date()) {
    const row = await this.prisma.weeklyHours.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Weekly hours not found');
    if (row.effective_from <= bkkDay(now)) throw new BadRequestException('Only an upcoming change can be removed');
    await this.prisma.weeklyHours.delete({ where: { id } });
    return { deleted: true };
  }

  private check(dto: SpecialDayDTO) {
    if (dto.to_date < dto.from_date) throw new BadRequestException('The range ends before it starts');
    if (dto.kind === SpecialDayKind.HOURS) {
      if (dto.from_date !== dto.to_date) throw new BadRequestException('Special hours are for one day');
      if (dto.open_min == null || dto.close_min == null || dto.close_min <= dto.open_min) throw new BadRequestException('Closing time must be after opening time');
    }
    return {
      kind: dto.kind,
      from_date: dto.from_date,
      to_date: dto.to_date,
      open_min: dto.kind === SpecialDayKind.HOURS ? dto.open_min : null,
      close_min: dto.kind === SpecialDayKind.HOURS ? dto.close_min : null,
      note: dto.note?.trim() || null,
    };
  }

  // A closed range that reaches into the past removes that time's empty auto shifts (they never happened)
  private async afterClosed(dto: SpecialDayDTO, now: Date) {
    const yesterday = addDays(bkkDay(now), -1);
    if (dto.kind !== SpecialDayKind.CLOSED || dto.from_date > yesterday) return { removed: 0, kept_days_with_sales: [] as string[] };
    return this.auto.dropEmptyAutoShifts(dto.from_date, dto.to_date < yesterday ? dto.to_date : yesterday);
  }

  async createSpecial(dto: SpecialDayDTO, staffId: string, now = new Date()) {
    const special = await this.prisma.specialDay.create({ data: { ...this.check(dto), update_by_staff_id: staffId } });
    return { special, ...(await this.afterClosed(dto, now)) };
  }

  async updateSpecial(id: string, dto: SpecialDayDTO, staffId: string, now = new Date()) {
    const special = await this.prisma.specialDay.update({ where: { id }, data: { ...this.check(dto), update_by_staff_id: staffId } }).catch(() => {
      throw new NotFoundException('Special day not found');
    });
    return { special, ...(await this.afterClosed(dto, now)) };
  }

  async deleteSpecial(id: string) {
    await this.prisma.specialDay.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Special day not found');
    });
    return { deleted: true };
  }
}

