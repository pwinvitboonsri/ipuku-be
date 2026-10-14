import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 503 on every Grab route until the integration is switched on and fully configured
@Injectable()
export class GrabEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const enabled = this.config.get<boolean>('grab.enabled');
    const ready =
      this.config.get<string>('grab.webhookJwtSecret') &&
      this.config.get<string>('grab.systemStaffId') &&
      this.config.get<string>('grab.partnerClientId') &&
      this.config.get<string>('grab.partnerClientSecret');

    if (!enabled || !ready) {
      throw new ServiceUnavailableException('Grab integration is off');
    }
    return true;
  }
}
