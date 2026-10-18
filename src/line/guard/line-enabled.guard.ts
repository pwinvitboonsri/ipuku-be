import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 503 on every LINE route until the integration is switched on and configured
@Injectable()
export class LineEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    const enabled = this.config.get<boolean>('line.enabled');
    const ready =
      this.config.get<string>('line.channelSecret') &&
      this.config.get<string>('line.channelAccessToken') &&
      this.config.get<string>('line.loginChannelId');

    if (!enabled || !ready) {
      throw new ServiceUnavailableException('LINE integration is off');
    }
    return true;
  }
}
