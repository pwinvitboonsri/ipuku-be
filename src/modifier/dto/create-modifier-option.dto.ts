import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateModifierOptionDTO {
  @IsNotEmpty()
  @IsUUID()
  group_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  // satang, can be negative, e.g. +10 baht -> 1000
  @IsNotEmpty()
  @IsInt()
  price_delta_satang: number;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sort_order: number;

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}
