import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { EarnRuleKind, LoyaltyCurrency } from '../../generated/prisma/enums.js';

// Back office → Loyalty → Earn rules (stamps per visit, ×N points, +N bonus) with schedule and filters
export class EarnRuleDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  name: string;

  @IsEnum(EarnRuleKind)
  kind: EarnRuleKind;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  amount?: number;

  @IsOptional()
  @IsEnum(LoyaltyCurrency)
  currency?: LoyaltyCurrency;

  // ×1.1 – ×10, in tenths
  @IsOptional()
  @IsInt()
  @Min(11)
  @Max(100)
  multiplier_x10?: number;

  @IsOptional()
  @IsBoolean()
  per_item?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  min_spend_satang?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  min_items?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  product_ids?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  category_ids?: string[];

  // 0 = Sunday … 6 = Saturday; empty = every day
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  // minutes since midnight, Thailand time; both or neither
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  time_from?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  time_to?: number | null;

  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @IsOptional()
  @IsDateString()
  ends_at?: string | null;

  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sort_order?: number;
}

export class EarnRuleStatusDTO {
  @IsBoolean()
  is_active: boolean;
}
