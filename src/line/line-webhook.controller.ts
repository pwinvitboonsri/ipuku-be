import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { LineEnabledGuard } from './guard/line-enabled.guard.js';
import { LineSignatureGuard } from './guard/line-signature.guard.js';
import { RecentIds } from './function/recent-ids.function.js';

interface LineWebhookEvent {
  type?: string;
  webhookEventId?: string;
  deliveryContext?: { isRedelivery?: boolean };
  source?: { type?: string; userId?: string };
}

// Webhook URL set in the Messaging API channel. LINE wants a fast 200;
// the body is a plain object so the global pipe doesn't reject LINE's fields.
@SkipThrottle()
@UseGuards(LineEnabledGuard, LineSignatureGuard)
@Controller('line')
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);
  // LINE may redeliver an event; one day covers its retry window
  private readonly seen = new RecentIds(24 * 60 * 60 * 1000);

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Body() body: { destination?: string; events?: LineWebhookEvent[] }) {
    // the console's "Verify" button sends an empty events array
    for (const event of body.events ?? []) {
      if (event.webhookEventId && !this.seen.firstSeen(event.webhookEventId)) {
        this.logger.log(`Duplicate event ${event.webhookEventId} skipped`);
        continue;
      }
      // PoC: log only. Phase 1 handles follow (pending contact + greeting) and unfollow.
      this.logger.log(
        `Event ${event.type} from ${event.source?.type}:${event.source?.userId ?? '-'}` +
          (event.deliveryContext?.isRedelivery ? ' (redelivery)' : ''),
      );
    }
    return {};
  }
}
