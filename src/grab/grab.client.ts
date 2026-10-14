import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Outbound calls to the GrabFood Partner API. In GRAB_MODE=mock nothing leaves the
// server: each call is logged and resolves, so the whole flow runs locally.
// Paths and bodies follow Grab's partner docs. ⚠ Check before going live.
@Injectable()
export class GrabClient {
  private readonly logger = new Logger(GrabClient.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private get mode() {
    return this.config.get<'mock' | 'staging' | 'production'>('grab.mode');
  }

  // Accept: only needed when the merchant is on MANUAL acceptance
  async acceptOrder(grabOrderId: string) {
    await this.post('/partner/v1/order/prepare', {
      orderID: grabOrderId,
      toState: 'Accepted',
    });
  }

  async rejectOrder(grabOrderId: string) {
    await this.post('/partner/v1/order/prepare', {
      orderID: grabOrderId,
      toState: 'Rejected',
    });
  }

  // Food is ready for the rider
  async markReady(grabOrderId: string) {
    await this.post('/partner/v1/orders/mark', {
      orderID: grabOrderId,
      markStatus: 1,
    });
  }

  // Ask Grab to pull GET /grab/merchant/menu again
  async notifyMenuUpdate() {
    await this.post('/partner/v1/merchant/menu/notification', {
      merchantID: this.config.get<string>('grab.merchantId'),
    });
  }

  private async post(path: string, body: Record<string, unknown>) {
    if (this.mode === 'mock') {
      this.logger.log(`[mock] POST ${path} ${JSON.stringify(body)}`);
      return;
    }

    const base = this.config.get<string>('grab.apiBaseUrl');
    if (!base) throw new Error('GRAB_API_BASE_URL is not set');

    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await this.accessToken()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // a stale token: drop it so the next call fetches a new one
      if (res.status === 401) this.token = null;
      throw new Error(`Grab ${path} answered ${res.status}: ${await res.text()}`);
    }
  }

  // OAuth2 client credentials, cached until a minute before it expires
  private async accessToken() {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

    const url = this.config.get<string>('grab.authUrl');
    if (!url) throw new Error('GRAB_AUTH_URL is not set');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: this.config.get<string>('grab.clientId'),
        client_secret: this.config.get<string>('grab.clientSecret'),
        grant_type: 'client_credentials',
        scope: 'food.partner_api',
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      throw new Error(`Grab token request answered ${res.status}`);
    }

    const json = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in - 60) * 1000,
    };
    return this.token.value;
  }
}
