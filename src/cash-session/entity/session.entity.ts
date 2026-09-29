export class SessionEntity {
  id: string;
  opening_float_satang: number;
  counted_cash_satang: number | null;
  expect_cash_satang: number | null;
  variance_satang: number | null;

  open_at: Date;
  close_at: Date | null;

  constructor(partial: Partial<SessionEntity>) {
    Object.assign(this, partial);
  }
}
