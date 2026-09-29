import { IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';

export class CreateRecipeDTO {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsNotEmpty()
  @IsUUID()
  ingredient_id: string;

  // hundredths of unit (x100), e.g. 25.5 -> 2550
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity_per_unit: number;
}
