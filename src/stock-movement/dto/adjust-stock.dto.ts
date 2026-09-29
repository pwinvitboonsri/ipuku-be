import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  NotEquals,
} from 'class-validator';
import { StockMovementReason } from '../../generated/prisma/enums.js';

// SALE is written only by payment, never by hand
export const ADJUST_REASONS = [
  StockMovementReason.RESTOCK,
  StockMovementReason.WASTE,
  StockMovementReason.COUNT_CORRECTION,
] as const;

export class AdjustStockDTO {
  @IsNotEmpty()
  @IsUUID()
  ingredient_id: string;

  // hundredths of unit (x100), + adds stock, - removes stock
  @IsNotEmpty()
  @IsInt()
  @NotEquals(0)
  change_quantity: number;

  @IsNotEmpty()
  @IsIn(ADJUST_REASONS)
  reason: (typeof ADJUST_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
