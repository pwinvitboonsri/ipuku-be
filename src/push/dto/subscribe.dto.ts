import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class SubscriptionKeysDTO {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  p256dh: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  auth: string;
}

// PushSubscription.toJSON() from the browser, minus expirationTime
export class SubscribeDTO {
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_tld: false })
  @MaxLength(1000)
  endpoint: string;

  @ValidateNested()
  @Type(() => SubscriptionKeysDTO)
  keys: SubscriptionKeysDTO;
}

export class UnsubscribeDTO {
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_tld: false })
  @MaxLength(1000)
  endpoint: string;
}
