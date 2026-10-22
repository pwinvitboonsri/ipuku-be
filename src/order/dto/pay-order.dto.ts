import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { PayTenderDTO } from './pay-tender.dto.js';

export class PayOrderDTO {
  // one tender for a normal payment, several for a mixed one; must add up to the order total.
  // Empty only for a ฿0 order (a reward covered everything).
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => PayTenderDTO)
  payments: PayTenderDTO[];
}
