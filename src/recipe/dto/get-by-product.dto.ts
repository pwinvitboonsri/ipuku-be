import { IsUUID } from 'class-validator';

export class GetByProductDTO {
  @IsUUID()
  productId: string;
}
