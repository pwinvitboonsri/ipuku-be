import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class JoinDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(32)
  consent_version: string;

  // optional birthday for the birthday perk: both or neither
  @ValidateIf((o: JoinDTO) => o.birth_month != null)
  @IsInt()
  @Min(1)
  @Max(31)
  birth_day?: number;

  @ValidateIf((o: JoinDTO) => o.birth_day != null)
  @IsInt()
  @Min(1)
  @Max(12)
  birth_month?: number;
}

// one of: token from the receipt QR URL, or the 6-character code typed from the receipt
export class ClaimDTO {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  code?: string;
}

// POS "Scan reward": the scanned QR text or the typed fallback code
export class ValidateRewardDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(64)
  input: string;
}
