import { IsInt, IsNotEmpty, NotEquals } from 'class-validator';

export class UpdateRecipeModifierDTO {
  // hundredths of unit (x100); negative takes away from the base recipe
  @IsNotEmpty()
  @IsInt()
  @NotEquals(0)
  quantity_delta: number;
}
