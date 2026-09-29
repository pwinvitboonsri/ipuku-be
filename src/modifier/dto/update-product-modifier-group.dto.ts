import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { ProductModifierGroupKeyDTO } from './product-modifier-group-key.dto.js';

export class UpdateProductModifierGroupDTO extends ProductModifierGroupKeyDTO {
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sort_order: number;
}
