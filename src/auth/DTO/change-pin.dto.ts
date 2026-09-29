import { IsString, Length, Matches } from 'class-validator';

export class ChangePinDTO {
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, {
    message: 'PIN must contain only numbers',
  })
  old_pin: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, {
    message: 'PIN must contain only numbers',
  })
  new_pin: string;
}
