import { IsInt, IsNotEmpty, IsUUID, NotEquals } from 'class-validator';

export class CreateRecipeModifierDTO {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsNotEmpty()
  @IsUUID()
  modifier_option_id: string;

  @IsNotEmpty()
  @IsUUID()
  ingredient_id: string;

  // hundredths of unit (x100), added to the base recipe when the option is sold;
  // negative takes away, e.g. Oat milk on a latte: whole milk -18000
  @IsNotEmpty()
  @IsInt()
  @NotEquals(0)
  quantity_delta: number;
}
