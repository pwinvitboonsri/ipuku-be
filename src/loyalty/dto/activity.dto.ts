import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PointsEntryType } from '../../generated/prisma/enums.js';

export class ListActivityDTO {
  @IsOptional()
  @IsEnum(PointsEntryType)
  type?: PointsEntryType;

  @IsOptional()
  @IsUUID()
  member_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
