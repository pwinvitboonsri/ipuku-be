import { Equals, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// OAuth2 client-credentials request Grab sends before calling our webhooks
export class GrabTokenRequestDTO {
  @IsNotEmpty()
  @IsString()
  client_id: string;

  @IsNotEmpty()
  @IsString()
  client_secret: string;

  @Equals('client_credentials')
  grant_type: string;

  @IsOptional()
  @IsString()
  scope?: string;
}
