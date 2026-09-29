import { IsBoolean, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateDTO {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsNumber()
  sort_order: number;

  @IsNotEmpty()
  @IsBoolean()
  is_active: boolean;
}
