import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaymentType } from '../../generated/prisma/enums.js';

export class PayOrderDTO {
  @IsNotEmpty()
  @IsEnum(PaymentType)
  method: PaymentType;

  // cash handed over by the customer (satang), required for CASH
  @ValidateIf((dto: PayOrderDTO) => dto.method === PaymentType.CASH)
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  tender_satang?: number;

  // PromptPay slip reference (static QR, confirmed by staff)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}
