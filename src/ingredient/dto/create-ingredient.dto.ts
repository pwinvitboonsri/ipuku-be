import { IsBoolean, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateIngredientDTO {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  unit: string;

  // hundredths of unit (x100), e.g. 25.5 -> 2550
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  stock_quantity: number;

  // hundredths of unit (x100), e.g. 25.5 -> 2550
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  reorder_level: number;

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}
