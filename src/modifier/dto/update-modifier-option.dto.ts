import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateModifierOptionDTO {
  @IsOptional()
  @IsString()
  name?: string;

  // satang, can be negative, e.g. +10 baht -> 1000
  @IsOptional()
  @IsInt()
  price_delta_satang?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
