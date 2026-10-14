import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service.js';
import { SubscribeDTO } from './dto/subscribe.dto.js';

export type PushPayload = {
  title: string;
  body: string;
  // same tag replaces the previous notification instead of stacking
  tag?: string;
  // page to open when the notification is tapped
  url?: string;
  // stays on screen until the user acts on it
  requireInteraction?: boolean;
};

// Web Push to every subscribed owner/staff device. Never throws: a push failure
// must not fail the caller (e.g. the Grab webhook).
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>('push.publicKey');
    const privateKey = this.config.get<string>('push.privateKey');
    const subject = this.config.get<string>('push.subject');

    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('VAPID keys not set: push alerts are off');
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
  }

  get publicKey() {
    return this.enabled ? this.config.get<string>('push.publicKey')! : null;
  }

  async subscribe(dto: SubscribeDTO, staffId: string, userAgent?: string) {
    return await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        user_agent: userAgent,
        staff_id: staffId,
      },
      // same browser, maybe a different person logged in now
      update: {
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        user_agent: userAgent,
        staff_id: staffId,
      },
    });
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  async sendToAll(payload: PushPayload) {
    if (!this.enabled) return { sent: 0, failed: 0 };

    const subs = await this.prisma.pushSubscription.findMany();
    const body = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          // an alert older than 10 minutes is useless
          { TTL: 600, urgency: 'high' },
        ),
      ),
    );

    let sent = 0;
    const dead: string[] = [];
    const ok: string[] = [];

    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        sent++;
        ok.push(subs[i].id);
        return;
      }
      const status = (r.reason as { statusCode?: number })?.statusCode;
      // 404/410: the browser dropped the subscription
      if (status === 404 || status === 410) dead.push(subs[i].id);
      else this.logger.warn(`Push to ${subs[i].id} failed: ${String(r.reason)}`);
    });

    try {
      if (dead.length) {
        await this.prisma.pushSubscription.deleteMany({
          where: { id: { in: dead } },
        });
        this.logger.log(`Removed ${dead.length} expired push subscription(s)`);
      }
      if (ok.length) {
        await this.prisma.pushSubscription.updateMany({
          where: { id: { in: ok } },
          data: { last_success_at: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`Push bookkeeping failed: ${String(error)}`);
    }

    return { sent, failed: subs.length - sent };
  }
}
