import { describe, expect, it } from 'vitest';
import { autoCloseAt, canAutoOpen, dayPlan, plans, validDays, type DayHours, type SpecialRow, type WeeklyRow } from './schedule.function.js';

// 10:00–18:00 every day but Saturday (index 6)
const tenToSix = (closedDays: number[] = [6]): DayHours[] => Array.from({ length: 7 }, (_, i) => ({ open: !closedDays.includes(i), open_min: 600, close_min: 1080 }));
const weekly: WeeklyRow[] = [
  { effective_from: '2026-10-01', days: tenToSix() },
  // from 1 Nov also closed on Sunday, and Monday opens at 08:00
  { effective_from: '2026-11-01', days: tenToSix([0, 6]).map((d, i) => (i === 1 ? { ...d, open_min: 480 } : d)) },
];
const special = (o: Partial<SpecialRow>): SpecialRow => ({ id: 's', kind: 'CLOSED', from_date: '', to_date: '', open_min: null, close_min: null, note: null, create_at: new Date('2026-10-01T00:00:00Z'), ...o });

describe('dayPlan', () => {
  it('uses the weekly pattern in force on that date', () => {
    // Thu 29 Oct: open 10:00–18:00 Thailand = 03:00–11:00 UTC
    const thu = dayPlan('2026-10-29', weekly, []);
    expect(thu).toMatchObject({ open: true, open_min: 600, close_min: 1080 });
    expect(thu.open && thu.open_at.toISOString()).toBe('2026-10-29T03:00:00.000Z');
    expect(thu.open && thu.close_at.toISOString()).toBe('2026-10-29T11:00:00.000Z');
    expect(dayPlan('2026-10-31', weekly, [])).toMatchObject({ open: false, reason: 'WEEKLY' }); // Saturday
    expect(dayPlan('2026-10-25', weekly, [])).toMatchObject({ open: true }); // Sunday, old pattern
    expect(dayPlan('2026-11-01', weekly, [])).toMatchObject({ open: false, reason: 'WEEKLY' }); // Sunday, new pattern
    expect(dayPlan('2026-11-02', weekly, [])).toMatchObject({ open: true, open_min: 480 }); // Monday 08:00
    expect(dayPlan('2026-09-30', weekly, [])).toMatchObject({ open: false, reason: 'NO_HOURS' });
  });

  it('special days override the week: closed ranges and special hours, newest wins', () => {
    const vacation = special({ id: 'v', from_date: '2026-10-27', to_date: '2026-10-29', note: 'Vacation' });
    const early = special({ id: 'e', kind: 'HOURS', from_date: '2026-10-28', to_date: '2026-10-28', open_min: 600, close_min: 900, create_at: new Date('2026-10-02T00:00:00Z') });
    expect(dayPlan('2026-10-27', weekly, [vacation])).toMatchObject({ open: false, reason: 'SPECIAL', note: 'Vacation' });
    expect(dayPlan('2026-10-28', weekly, [vacation, early])).toMatchObject({ open: true, close_min: 900, special_id: 'e' });
    expect(dayPlan('2026-10-30', weekly, [vacation])).toMatchObject({ open: true });
    // a special-hours day can open the shop on a weekly day off
    expect(dayPlan('2026-10-31', weekly, [special({ kind: 'HOURS', from_date: '2026-10-31', to_date: '2026-10-31', open_min: 540, close_min: 720 })])).toMatchObject({ open: true, open_min: 540 });
  });

  it('lists a range of days', () => {
    expect(plans('2026-10-29', '2026-11-01', weekly, []).map((p) => p.open)).toEqual([true, true, false, false]);
  });
});

describe('auto open / close windows', () => {
  const thu = dayPlan('2026-10-29', weekly, []);
  const sat = dayPlan('2026-10-31', weekly, []);

  it('opens only inside hours (until the grace after closing)', () => {
    expect(canAutoOpen(thu, new Date('2026-10-29T02:59:00Z'), 30)).toBe(false); // 09:59
    expect(canAutoOpen(thu, new Date('2026-10-29T03:00:00Z'), 30)).toBe(true); // 10:00
    expect(canAutoOpen(thu, new Date('2026-10-29T11:20:00Z'), 30)).toBe(true); // 18:20
    expect(canAutoOpen(thu, new Date('2026-10-29T11:30:00Z'), 30)).toBe(false); // 18:30
    expect(canAutoOpen(sat, new Date('2026-10-31T05:00:00Z'), 30)).toBe(false);
  });

  it('closes at closing time after the grace; a shift on a day off closes at that day\'s end', () => {
    expect(autoCloseAt(thu, 30)).toEqual({ scheduled: new Date('2026-10-29T11:00:00Z'), deadline: new Date('2026-10-29T11:30:00Z') });
    expect(autoCloseAt(sat, 30)).toEqual({ scheduled: new Date('2026-10-31T17:00:00Z'), deadline: new Date('2026-10-31T17:00:00Z') });
    // opened by hand after closing (evening event): runs to midnight
    expect(autoCloseAt(thu, 30, new Date('2026-10-29T13:00:00Z'))).toEqual({ scheduled: new Date('2026-10-29T17:00:00Z'), deadline: new Date('2026-10-29T17:00:00Z') });
  });
});

describe('validDays', () => {
  it('needs 7 days with closing after opening on open days', () => {
    expect(validDays(tenToSix())).toBe(true);
    expect(validDays(tenToSix().slice(1))).toBe(false);
    expect(validDays(tenToSix().map((d, i) => (i === 2 ? { ...d, close_min: 500 } : d)))).toBe(false);
    expect(validDays(tenToSix().map((d, i) => (i === 6 ? { ...d, close_min: 500 } : d)))).toBe(true); // closed day: hours ignored
  });
});
