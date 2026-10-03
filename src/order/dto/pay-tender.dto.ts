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

// One part of a payment. A mixed payment is several of these (e.g. PromptPay + cash).
export class PayTenderDTO {
  @IsNotEmpty()
  @IsEnum(PaymentType)
  method: PaymentType;

  // the part of the order total this tender covers (satang)
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  amount_satang: number;

  // cash handed over by the customer (satang), required for CASH; >= amount_satang
  @ValidateIf((dto: PayTenderDTO) => dto.method === PaymentType.CASH)
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
