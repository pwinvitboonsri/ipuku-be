import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class UpdateProductDTO {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  price_satang?: number;

  // an uploaded image's public_url, or null to remove the photo
  @IsOptional()
  @IsString()
  image_url?: string | null;

  @IsOptional()
  @IsUUID()
  category_id?: string;
}
