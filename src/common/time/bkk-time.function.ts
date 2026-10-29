// Thailand calendar days (UTC+7, no daylight saving). The DB stores UTC instants.

export const BKK_MS = 7 * 3_600_000;
export const DAY_MS = 86_400_000;

/// 'YYYY-MM-DD' (Thailand) of a UTC instant
export function bkkDay(at: Date): string {
  return new Date(at.getTime() + BKK_MS).toISOString().slice(0, 10);
}

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

/// day of week of a Thailand date, 0 = Sunday
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/// minutes after midnight (Thailand) of a UTC instant
export function bkkMinutes(at: Date): number {
  const t = new Date(at.getTime() + BKK_MS);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}
