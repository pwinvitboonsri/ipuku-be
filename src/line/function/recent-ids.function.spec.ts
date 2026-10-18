import { describe, expect, it } from 'vitest';
import { RecentIds } from './recent-ids.function.js';

describe('RecentIds', () => {
  it('reports an id as new only the first time', () => {
    const ids = new RecentIds(1000);
    expect(ids.firstSeen('a', 0)).toBe(true);
    expect(ids.firstSeen('a', 10)).toBe(false);
    expect(ids.firstSeen('b', 10)).toBe(true);
  });

  it('forgets ids after the window', () => {
    const ids = new RecentIds(1000);
    ids.firstSeen('a', 0);
    expect(ids.firstSeen('a', 1000)).toBe(true);
  });

  it('drops the oldest id when full', () => {
    const ids = new RecentIds(1000, 2);
    ids.firstSeen('a', 0);
    ids.firstSeen('b', 1);
    ids.firstSeen('c', 2);
    expect(ids.firstSeen('a', 3)).toBe(true);
    expect(ids.firstSeen('c', 3)).toBe(false);
  });
});
