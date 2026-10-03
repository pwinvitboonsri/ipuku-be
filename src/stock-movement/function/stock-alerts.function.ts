// Which ingredients a sale just pushed over the line. Only the crossing is
// reported (above -> at/below reorder level, or above 0 -> 0 or less), so the
// counter shows each alert once instead of on every sale while stock is low.
// Quantities are hundredths of the unit.

export type StockAlertStatus = 'LOW' | 'OUT';

export type StockAlert = {
  ingredient_id: string;
  name: string;
  unit: string;
  stock_quantity: number;
  reorder_level: number;
  status: StockAlertStatus;
};

export type DeductedIngredient = {
  id: string;
  name: string;
  unit: string;
  is_active: boolean;
  reorder_level: number;
  // stock after this sale
  stock_quantity: number;
  // how much this sale took
  used: number;
};

export function stockAlertsAfterSale(rows: DeductedIngredient[]): StockAlert[] {
  const alerts: StockAlert[] = [];
  for (const r of rows) {
    if (!r.is_active || r.used <= 0) continue;
    const before = r.stock_quantity + r.used;
    const after = r.stock_quantity;
    const ranOut = before > 0 && after <= 0;
    const wentLow = before > r.reorder_level && after <= r.reorder_level;
    if (!ranOut && !wentLow) continue;
    alerts.push({
      ingredient_id: r.id,
      name: r.name,
      unit: r.unit,
      stock_quantity: after,
      reorder_level: r.reorder_level,
      status: after <= 0 ? 'OUT' : 'LOW',
    });
  }
  return alerts.sort(
    (a, b) =>
      (a.status === 'OUT' ? 0 : 1) - (b.status === 'OUT' ? 0 : 1) ||
      a.name.localeCompare(b.name),
  );
}
