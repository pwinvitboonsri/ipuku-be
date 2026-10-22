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
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

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
  constructor(private readonly prisma: PrismaService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(@Body() body: { destination?: string; events?: LineWebhookEvent[] }) {
    // the console's "Verify" button sends an empty events array
    for (const event of body.events ?? []) {
      const id = event.webhookEventId;
      if (id && (await this.prisma.lineWebhookEvent.findUnique({ where: { id } }))) {
        this.logger.log(`Duplicate event ${id} skipped`);
        continue;
      }
      this.logger.log(
        `Event ${event.type} from ${event.source?.type}:${event.source?.userId ?? '-'}` +
          (event.deliveryContext?.isRedelivery ? ' (redelivery)' : ''),
      );
      // a failure here is a 500, so LINE redelivers; the event is only recorded once handled
      await this.handle(event);
      if (id) await this.markHandled(id, event.type);
    }
    return {};
  }

  private async markHandled(id: string, type?: string) {
    try {
      await this.prisma.lineWebhookEvent.create({ data: { id, type: type ?? 'unknown' } });
    } catch (err) {
      // a concurrent redelivery got here first; handling is idempotent
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
  }

  // follow/unfollow keep a contact list of friends; the greeting is set by the owner in OA Manager
  private async handle(event: LineWebhookEvent) {
    const userId = event.source?.type === 'user' ? event.source.userId : undefined;
    if (!userId || (event.type !== 'follow' && event.type !== 'unfollow')) return;
    const follow = event.type === 'follow';
    const now = new Date();
    await this.prisma.lineContact.upsert({
      where: { line_user_id: userId },
      create: { line_user_id: userId, is_friend: follow, ...(follow ? { followed_at: now } : { unfollowed_at: now }) },
      update: { is_friend: follow, ...(follow ? { followed_at: now } : { unfollowed_at: now }) },
    });
  }
}
