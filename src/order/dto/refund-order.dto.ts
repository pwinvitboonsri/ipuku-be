import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RefundOrderDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string;
}
