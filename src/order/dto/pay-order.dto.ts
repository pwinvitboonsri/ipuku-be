import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PayTenderDTO } from './pay-tender.dto.js';

export class PayOrderDTO {
  // one tender for a normal payment, several for a mixed one; must add up to the order total
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PayTenderDTO)
  payments: PayTenderDTO[];
}
