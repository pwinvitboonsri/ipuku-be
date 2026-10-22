import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const LINE_API = 'https://api.line.me';

// claims we use from a verified LIFF ID token
export interface LineIdentity {
  userId: string;
  name: string | null;
  picture: string | null;
  /// when LINE stops accepting this ID token (ms since epoch)
  expiresAt: number;
}

export interface LinePushResult {
  ok: boolean;
  status: number;
  body: unknown;
}

@Injectable()
export class LineClient {
  private readonly logger = new Logger(LineClient.name);

  constructor(private readonly config: ConfigService) {}

  // LINE checks signature, expiry (1 h) and audience; we never trust the token's payload ourselves
  async verifyIdToken(idToken: string): Promise<LineIdentity> {
    const res = await fetch(`${LINE_API}/oauth2/v2.1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: this.config.get<string>('line.loginChannelId')!,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (!res.ok || typeof body.sub !== 'string') {
      // e.g. 400 "IdToken expired." -> the LIFF app re-fetches a token and retries
      throw new UnauthorizedException(
        `LINE ID token rejected: ${String(body.error_description ?? res.status)}`,
      );
    }
    return {
      userId: body.sub,
      name: typeof body.name === 'string' ? body.name : null,
      picture: typeof body.picture === 'string' ? body.picture : null,
      expiresAt: typeof body.exp === 'number' ? body.exp * 1000 : Date.now() + 60_000,
    };
  }

  // Never throws: a blocked OA or non-friend is expected, and the ledger stays the source of truth
  async pushText(to: string, text: string): Promise<LinePushResult> {
    return await this.push(to, [{ type: 'text', text }]);
  }

  // Up to 5 message objects (text, flex…) in one push
  async push(to: string, messages: object[]): Promise<LinePushResult> {
    const res = await fetch(`${LINE_API}/v2/bot/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.get<string>('line.channelAccessToken')}`,
      },
      body: JSON.stringify({ to, messages }),
    }).catch((err: Error) => {
      this.logger.warn(`Push to ${to} failed to send: ${err.message}`);
      return null;
    });

    if (!res) return { ok: false, status: 0, body: null };

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.warn(`Push to ${to} rejected (${res.status}): ${JSON.stringify(body)}`);
    }
    return { ok: res.ok, status: res.status, body };
  }
}
