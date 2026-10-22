// Date helpers and pure aggregation for the Back office dashboard.
// Days are Thailand calendar days (UTC+7, no daylight saving); the DB stores UTC.

const BKK_MS = 7 * 3_600_000;
const DAY_MS = 86_400_000;

/// 'YYYY-MM-DD' (Thailand) of a UTC instant
export function bkkDay(at: Date): string {
  return new Date(at.getTime() + BKK_MS).toISOString().slice(0, 10);
}

/// 'YYYY-MM' (Thailand) of a UTC instant
export const bkkMonth = (at: Date) => bkkDay(at).slice(0, 7);

/// UTC instant where a Thailand day starts
export function dayStart(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - BKK_MS);
}

export function addDays(day: string, n: number): string {
  return bkkDay(new Date(dayStart(day).getTime() + n * DAY_MS));
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}

export type Period = { from: string; to: string; start: Date; end: Date };

/// [start, end) in UTC for Thailand days from..to; `until` cuts the end short (today so far)
export function period(from: string, to: string, until?: Date): Period {
  const end = dayStart(addDays(to, 1));
  return { from, to, start: dayStart(from), end: until && until < end ? until : end };
}

/// The range compared against: given, or the same number of days right before
export function previousPeriod(cur: Period, prevFrom?: string, prevTo?: string, prevUntil?: Date): Period {
  if (prevFrom && prevTo) return period(prevFrom, prevTo, prevUntil);
  const len = daysBetween(cur.from, cur.to).length;
  return period(addDays(cur.from, -len), addDays(cur.from, -1), prevUntil);
}

export type Cohort = { month: string; members: number; retention: (number | null)[] };

/// Members who joined in a month, and the share with a paid visit in each of the next `span` months.
/// A month that hasn't started yet is null.
export function cohortTable(
  joined: { month: string; members: number }[],
  visits: { cohort: string; month: string; members: number }[],
  nowMonth: string,
  keep = 6,
  span = 3,
): Cohort[] {
  return joined
    .filter((j) => j.members > 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-keep)
    .map((j) => ({
      month: j.month,
      members: j.members,
      retention: Array.from({ length: span }, (_, i) => {
        const m = addMonths(j.month, i + 1);
        if (m > nowMonth) return null;
        const n = visits.find((v) => v.cohort === j.month && v.month === m)?.members ?? 0;
        return n / j.members;
      }),
    }));
}

/// Every day of the given periods, zero-filled, sorted
export function fillDays<T extends Record<string, number>>(periods: Period[], zero: T, rows: Map<string, Partial<T>>): (T & { date: string })[] {
  const days = new Set<string>();
  periods.forEach((p) => daysBetween(p.from, p.to).forEach((d) => days.add(d)));
  return [...days].sort().map((date) => ({ ...zero, ...rows.get(date), date }));
}
