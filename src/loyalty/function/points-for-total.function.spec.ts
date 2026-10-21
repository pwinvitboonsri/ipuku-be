import { describe, expect, it } from 'vitest';
import { pointsForTotal } from './points-for-total.function.js';

describe('pointsForTotal', () => {
  const rule = { points_per_unit: 1, unit_satang: 1000 };

  it('rounds down to whole units', () => {
    expect(pointsForTotal(14500, rule)).toBe(14);
    expect(pointsForTotal(999, rule)).toBe(0);
  });

  it('multiplies by points per unit', () => {
    expect(pointsForTotal(14500, { points_per_unit: 3, unit_satang: 5000 })).toBe(6);
  });

  it('gives nothing for zero, negative or a broken rule', () => {
    expect(pointsForTotal(0, rule)).toBe(0);
    expect(pointsForTotal(-500, rule)).toBe(0);
    expect(pointsForTotal(14500, { points_per_unit: 1, unit_satang: 0 })).toBe(0);
  });
});
