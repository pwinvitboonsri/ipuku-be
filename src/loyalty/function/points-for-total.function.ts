// Points for a paid total: points_per_unit for every whole unit_satang, rounded down.
// 1 pt / ฿10 on ฿145 -> 14.
export function pointsForTotal(totalSatang: number, rule: { points_per_unit: number; unit_satang: number }): number {
  if (totalSatang <= 0 || rule.unit_satang <= 0 || rule.points_per_unit <= 0) return 0;
  return Math.floor(totalSatang / rule.unit_satang) * rule.points_per_unit;
}
