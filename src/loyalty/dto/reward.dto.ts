import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { LoyaltyCurrency, RewardType } from '../../generated/prisma/enums.js';

const capped = (o: CreateRewardDTO) => o.type === RewardType.FREE_ITEM;

export class CreateRewardDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  name: string;

  @IsInt()
  @Min(1)
  @Max(1_000_000)
  cost_points: number;

  @IsEnum(RewardType)
  type: RewardType;

  // FIXED_DISCOUNT only
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.FIXED_DISCOUNT)
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  discount_satang?: number;

  // FREE_ITEM only: the product
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.FREE_ITEM)
  @IsUUID()
  product_id?: string;

  // the most it can take off: required for FREE_ITEM, optional cap for the other non-fixed types
  @ValidateIf((o: CreateRewardDTO) => capped(o) || o.max_discount_satang != null)
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  max_discount_satang?: number | null;

  @IsOptional()
  @IsEnum(LoyaltyCurrency)
  cost_currency?: LoyaltyCurrency;

  // PERCENT_OFF
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.PERCENT_OFF)
  @IsInt()
  @Min(1)
  @Max(100)
  percent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  min_spend_satang?: number | null;

  // FREE_OPTION: at least one option
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.FREE_OPTION)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  option_ids?: string[];

  // PERCENT_OFF / FREE_OPTION / BUY_X_GET_Y: limit to products / categories (empty = all)
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

  // BUY_X_GET_Y
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.BUY_X_GET_Y)
  @IsInt()
  @Min(1)
  @Max(20)
  buy_qty?: number;

  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.BUY_X_GET_Y)
  @IsInt()
  @Min(1)
  @Max(20)
  get_qty?: number;

  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.BUY_X_GET_Y)
  @IsInt()
  @Min(1)
  @Max(100)
  get_percent?: number;

  @IsOptional()
  @IsDateString()
  starts_at?: string | null;

  @IsOptional()
  @IsDateString()
  ends_at?: string | null;

  @IsOptional()
  @IsBoolean()
  combine_with_promotions?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sort_order?: number;

  // an uploaded image's public_url (POST /product/image-upload), or null for none
  @IsOptional()
  @IsString()
  @MaxLength(500)
  image_url?: string | null;
}

export class UpdateRewardDTO extends CreateRewardDTO {}

export class UpdateRewardStatusDTO {
  @IsBoolean()
  is_active: boolean;
}

export class ListMembersDTO {
  // name or member number ("IPK-000042", "42")
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
