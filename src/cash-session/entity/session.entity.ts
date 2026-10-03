export class SessionEntity {
  id: string;
  opening_float_satang: number;
  counted_cash_satang: number | null;
  expect_cash_satang: number | null;
  variance_satang: number | null;

  open_at: Date;
  close_at: Date | null;

  // list only: PAID orders and their total (refunds are full-order, so this is net sales)
  paid_orders?: number;
  net_sales_satang?: number;

  constructor(partial: Partial<SessionEntity>) {
    Object.assign(this, partial);
  }
}
