import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

// ?include_inactive=true, honoured for OWNER only (see controllers)
export class IncludeInactiveDTO {
  @IsOptional()
  // @Type(() => Boolean) would turn "false" into true
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_inactive?: boolean;
}

// inactive rows are an owner (back office) concern; staff always get active only
export function canSeeInactive(
  query: IncludeInactiveDTO,
  user: { role?: string } | undefined,
) {
  return query.include_inactive === true && user?.role === 'OWNER';
}
