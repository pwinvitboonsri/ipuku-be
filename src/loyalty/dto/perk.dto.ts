import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { WelcomeTrigger } from '../../generated/prisma/enums.js';

// Back office → Loyalty → Perks (welcome / birthday)
export class UpdatePerkDTO {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(WelcomeTrigger)
  trigger?: WelcomeTrigger;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  grant_points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  grant_stamps?: number;

  // a reward given as a coupon; null = no coupon
  @IsOptional()
  @IsUUID()
  reward_id?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  coupon_valid_days?: number;

  @IsOptional()
  @IsBoolean()
  send_message?: boolean;
}
