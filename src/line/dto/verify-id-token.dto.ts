import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// liff.getIDToken() from the LIFF app
export class VerifyIdTokenDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(4000)
  id_token: string;
}
