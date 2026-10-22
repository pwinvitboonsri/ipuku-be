import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

// Back office → Loyalty → Program. Applies to orders paid after the change.
export class UpdateProgramDTO {
  // 0 = no base points (e.g. a stamps-only program)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  points_per_unit?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  unit_satang?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 30)
  claim_valid_hours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  reward_code_minutes?: number;

  // bump when the consent text in the LIFF app changes; members are asked again
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[\w.-]+$/)
  consent_version?: string;
}
