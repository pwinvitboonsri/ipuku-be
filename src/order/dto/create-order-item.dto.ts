import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateOrderItemDTO {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  modifier_option_ids: string[];
}
