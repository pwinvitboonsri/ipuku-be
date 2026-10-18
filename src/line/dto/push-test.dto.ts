import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

// PoC only: owner pushes a text to one LINE userId to see what LINE returns
export class PushTestDTO {
  @Matches(/^U[0-9a-f]{32}$/, { message: 'to must be a LINE userId (U + 32 hex)' })
  to: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  text: string;
}
