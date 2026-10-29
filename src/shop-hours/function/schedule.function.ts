import { addDays, dayStart, daysBetween, weekday } from '../../common/time/bkk-time.function.js';

// When the shop is open on a Thailand date: the weekly pattern in force that day, overridden by special days.

export type DayHours = { open: boolean; open_min: number; close_min: number };
export type WeeklyRow = { effective_from: string; days: DayHours[] };
export type SpecialRow = {
  id: string;
  kind: 'CLOSED' | 'HOURS';
  from_date: string;
  to_date: string;
  open_min: number | null;
  close_min: number | null;
  note: string | null;
  create_at: Date;
};

export type DayPlan =
  | { date: string; open: false; reason: 'WEEKLY' | 'SPECIAL' | 'NO_HOURS'; special_id: string | null; note: string | null }
  | { date: string; open: true; open_at: Date; close_at: Date; open_min: number; close_min: number; special_id: string | null; note: string | null };

/// Sunday-first; the shape every week row has
export const WEEKDAYS = 7;

export function validDays(days: unknown): days is DayHours[] {
  return (
    Array.isArray(days) &&
    days.length === WEEKDAYS &&
    days.every(
      (d) =>
        d &&
        typeof d.open === 'boolean' &&
        Number.isInteger(d.open_min) &&
        Number.isInteger(d.close_min) &&
        d.open_min >= 0 &&
        d.close_min <= 24 * 60 &&
        (!d.open || d.close_min > d.open_min),
    )
  );
}

/// the weekly pattern for a date: the latest one that started on or before it
export function weeklyFor(date: string, weekly: WeeklyRow[]): WeeklyRow | null {
  return weekly.filter((w) => w.effective_from <= date).sort((a, b) => b.effective_from.localeCompare(a.effective_from))[0] ?? null;
}

/// the special day covering a date; when several overlap, the newest wins
export function specialFor(date: string, specials: SpecialRow[]): SpecialRow | null {
  return specials.filter((s) => s.from_date <= date && date <= s.to_date).sort((a, b) => b.create_at.getTime() - a.create_at.getTime())[0] ?? null;
}

const at = (date: string, min: number) => new Date(dayStart(date).getTime() + min * 60_000);

export function dayPlan(date: string, weekly: WeeklyRow[], specials: SpecialRow[]): DayPlan {
  const special = specialFor(date, specials);
  if (special?.kind === 'CLOSED') return { date, open: false, reason: 'SPECIAL', special_id: special.id, note: special.note };
  if (special?.kind === 'HOURS' && special.open_min != null && special.close_min != null) {
    return { date, open: true, open_min: special.open_min, close_min: special.close_min, open_at: at(date, special.open_min), close_at: at(date, special.close_min), special_id: special.id, note: special.note };
  }
  const week = weeklyFor(date, weekly);
  if (!week) return { date, open: false, reason: 'NO_HOURS', special_id: null, note: null };
  const day = week.days[weekday(date)];
  if (!day?.open) return { date, open: false, reason: 'WEEKLY', special_id: null, note: null };
  return { date, open: true, open_min: day.open_min, close_min: day.close_min, open_at: at(date, day.open_min), close_at: at(date, day.close_min), special_id: null, note: null };
}

export function plans(from: string, to: string, weekly: WeeklyRow[], specials: SpecialRow[]): DayPlan[] {
  return daysBetween(from, to).map((d) => dayPlan(d, weekly, specials));
}

/// When a shift opened on `date` must be closed by itself: closing time + grace. A shift opened by hand
/// on a day off, or after closing time (an evening event), runs to the end of that day.
export function autoCloseAt(plan: DayPlan, graceMinutes: number, openedAt?: Date): { scheduled: Date; deadline: Date } {
  const endOfDay = dayStart(addDays(plan.date, 1));
  if (!plan.open || (openedAt && openedAt >= plan.close_at)) return { scheduled: endOfDay, deadline: endOfDay };
  return { scheduled: plan.close_at, deadline: new Date(plan.close_at.getTime() + graceMinutes * 60_000) };
}

/// A shift opens by itself only inside opening hours (until the grace after closing ends)
export function canAutoOpen(plan: DayPlan, now: Date, graceMinutes: number): boolean {
  return plan.open && now >= plan.open_at && now.getTime() < plan.close_at.getTime() + graceMinutes * 60_000;
}

