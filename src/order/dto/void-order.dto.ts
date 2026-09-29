import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VoidOrderDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string;
}
