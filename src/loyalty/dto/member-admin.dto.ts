import { IsEnum, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, NotEquals, ValidateIf } from 'class-validator';
import { LoyaltyCurrency } from '../../generated/prisma/enums.js';

// Owner's manual correction: +/- points or stamps, with a reason (audited, an ADJUST ledger row)
export class AdjustPointsDTO {
  @IsEnum(LoyaltyCurrency)
  currency: LoyaltyCurrency;

  @IsInt()
  @NotEquals(0)
  @Min(-100_000)
  @Max(100_000)
  amount: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string;
}

// Owner sets or clears a member's birthday (members set it once themselves)
export class MemberBirthdayDTO {
  @ValidateIf((o: MemberBirthdayDTO) => o.birth_month !== null)
  @IsInt()
  @Min(1)
  @Max(31)
  birth_day: number | null;

  @ValidateIf((o: MemberBirthdayDTO) => o.birth_day !== null)
  @IsInt()
  @Min(1)
  @Max(12)
  birth_month: number | null;
}
