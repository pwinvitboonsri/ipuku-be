import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const DAY_MSG = 'must be a Thailand date, YYYY-MM-DD';

export class ShopSettingsDTO {
  @IsOptional()
  @IsBoolean()
  auto_shift?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(240)
  auto_close_grace_minutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  default_float_satang?: number;
}

// The whole week from a date on: 7 entries, Sunday first ({ open, open_min, close_min }, checked in the service)
export class WeeklyHoursDTO {
  @Matches(DAY, { message: `effective_from ${DAY_MSG}` })
  effective_from: string;

  @IsArray()
  days: unknown[];
}

export class SpecialDayDTO {
  @IsIn(['CLOSED', 'HOURS'])
  kind: 'CLOSED' | 'HOURS';

  @Matches(DAY, { message: `from_date ${DAY_MSG}` })
  from_date: string;

  @Matches(DAY, { message: `to_date ${DAY_MSG}` })
  to_date: string;

  @ValidateIf((o: SpecialDayDTO) => o.kind === 'HOURS')
  @IsInt()
  @Min(0)
  @Max(1440)
  open_min?: number;

  @ValidateIf((o: SpecialDayDTO) => o.kind === 'HOURS')
  @IsInt()
  @Min(0)
  @Max(1440)
  close_min?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}
