import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { RewardType } from '../../generated/prisma/enums.js';

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

  // FREE_ITEM only: the product, and the most it can take off
  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.FREE_ITEM)
  @IsUUID()
  product_id?: string;

  @ValidateIf((o: CreateRewardDTO) => o.type === RewardType.FREE_ITEM)
  @IsInt()
  @Min(100)
  @Max(10_000_000)
  max_discount_satang?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sort_order?: number;
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
