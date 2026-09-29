import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class UpdateRecipeDTO {
  // hundredths of unit (x100), e.g. 25.5 -> 2550
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity_per_unit: number;
}
