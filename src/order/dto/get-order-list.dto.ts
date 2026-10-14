import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { OrderChannel, Status } from '../../generated/prisma/enums.js';

export class GetOrderListDTO {
  // defaults to the current open cash session
  @IsOptional()
  @IsUUID()
  cash_session_id?: string;

  @IsOptional()
  @IsEnum(Status)
  status?: Status;

  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;
}
