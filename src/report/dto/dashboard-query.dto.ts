import { IsISO8601, IsOptional, Matches } from 'class-validator';

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MSG = 'must be a Thailand date, YYYY-MM-DD';

// Thailand calendar days, both ends included. The previous range defaults to the same number of days right before.
export class DashboardQueryDTO {
  @Matches(DAY, { message: `from ${MSG}` })
  from: string;

  @Matches(DAY, { message: `to ${MSG}` })
  to: string;

  @IsOptional()
  @Matches(DAY, { message: `prev_from ${MSG}` })
  prev_from?: string;

  @IsOptional()
  @Matches(DAY, { message: `prev_to ${MSG}` })
  prev_to?: string;

  /// cut the previous range at this instant (compare "today so far" with yesterday up to the same time)
  @IsOptional()
  @IsISO8601()
  prev_until?: string;
}
