import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class ResetPinDTO {
  @IsUUID()
  id: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, {
    message: 'PIN must contain only numbers',
  })
  new_pin: string;
}
