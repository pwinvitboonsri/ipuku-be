import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class GetSessionList {
  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  before: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  after?: Date;

  @IsOptional()
  @Type(() => Boolean)
  is_opening?: boolean;

  @IsOptional()
  @IsUUID()
  opened_by_staff_id?: string;

  @IsOptional()
  @IsUUID()
  close_by_staff_id?: string;
}
