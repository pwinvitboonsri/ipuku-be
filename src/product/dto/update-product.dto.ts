import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateProductDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price_satang?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsUUID()
  category_id?: string;
}
