import { describe, expect, it } from 'vitest';
import { addDays, addMonths, bkkDay, cohortTable, dayStart, daysBetween, fillDays, period, previousPeriod } from './dashboard.function.js';

describe('Thailand days', () => {
  it('a day starts at 17:00 UTC the day before', () => {
    expect(dayStart('2026-10-22').toISOString()).toBe('2026-10-21T17:00:00.000Z');
  });

  it('maps a late-evening UTC instant to the next Thai day', () => {
    expect(bkkDay(new Date('2026-10-21T16:59:59Z'))).toBe('2026-10-21');
    expect(bkkDay(new Date('2026-10-21T17:00:00Z'))).toBe('2026-10-22');
  });

  it('walks days and months across boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(addMonths('2026-11', 2)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});

describe('periods', () => {
  it('compares with the same number of days right before', () => {
    const cur = period('2026-10-16', '2026-10-22');
    const prev = previousPeriod(cur);
    expect([prev.from, prev.to]).toEqual(['2026-10-09', '2026-10-15']);
    expect(prev.end.toISOString()).toBe(cur.start.toISOString());
  });

  it('takes an explicit previous range and cuts it at `until`', () => {
    const until = new Date('2026-10-21T04:00:00Z');
    const prev = previousPeriod(period('2026-10-22', '2026-10-22'), '2026-10-21', '2026-10-21', until);
    expect(prev.start.toISOString()).toBe('2026-10-20T17:00:00.000Z');
    expect(prev.end).toBe(until);
  });
});

describe('cohortTable', () => {
  it('gives the share that came back each month, null for months not started', () => {
    const rows = cohortTable(
      [
        { month: '2026-08', members: 10 },
        { month: '2026-09', members: 4 },
        { month: '2026-10', members: 0 },
      ],
      [
        { cohort: '2026-08', month: '2026-09', members: 5 },
        { cohort: '2026-08', month: '2026-10', members: 2 },
        { cohort: '2026-09', month: '2026-10', members: 1 },
      ],
      '2026-10',
    );
    expect(rows).toEqual([
      { month: '2026-08', members: 10, retention: [0.5, 0.2, null] },
      { month: '2026-09', members: 4, retention: [0.25, null, null] },
    ]);
  });
});

describe('fillDays', () => {
  it('zero-fills every day of both periods once', () => {
    const rows = new Map([['2026-10-02', { orders: 3 }]]);
    const days = fillDays([period('2026-10-02', '2026-10-03'), period('2026-10-01', '2026-10-02')], { orders: 0 }, rows);
    expect(days).toEqual([
      { date: '2026-10-01', orders: 0 },
      { date: '2026-10-02', orders: 3 },
      { date: '2026-10-03', orders: 0 },
    ]);
  });
});
