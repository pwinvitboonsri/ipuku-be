import { IsNotEmpty, IsUUID } from 'class-validator';

export class ProductModifierGroupKeyDTO {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsNotEmpty()
  @IsUUID()
  modifier_group_id: string;
}
