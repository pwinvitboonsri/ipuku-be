import { IsIn, IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from '../../storage/function/product-image.function.js';

// What the browser is about to upload (already resized on the device)
export class ImageUploadDTO {
  @IsNotEmpty()
  @IsIn(Object.keys(IMAGE_TYPES))
  content_type: string;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_BYTES)
  size: number;
}
