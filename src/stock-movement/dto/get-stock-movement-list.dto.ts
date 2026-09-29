import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { StockMovementReason } from '../../generated/prisma/enums.js';

export class GetStockMovementListDTO {
  @IsOptional()
  @IsUUID()
  ingredient_id?: string;

  @IsOptional()
  @IsEnum(StockMovementReason)
  reason?: StockMovementReason;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  after?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  before?: Date;
}
