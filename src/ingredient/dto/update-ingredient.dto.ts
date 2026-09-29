import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateIngredientDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  // hundredths of unit (x100), e.g. 25.5 -> 2550
  @IsOptional()
  @IsInt()
  @Min(0)
  reorder_level?: number;
}
