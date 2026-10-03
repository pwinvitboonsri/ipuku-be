import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { keyFromUrl, productImageKey } from './function/product-image.function.js';

type R2Config = {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  bucket?: string;
  publicUrl?: string;
};

const UPLOAD_TTL_S = 300;
// keys are never reused, so a photo can be cached forever
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// Product photos in Cloudflare R2. The browser uploads straight to R2 with a
// presigned PUT; this service only signs, checks and deletes.
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly cfg: R2Config;
  private readonly client: S3Client | null;

  constructor(config: ConfigService) {
    this.cfg = config.get<R2Config>('r2') ?? {};
    const { endpoint, accessKeyId, secretAccessKey, bucket, publicUrl } =
      this.cfg;
    this.client =
      endpoint && accessKeyId && secretAccessKey && bucket && publicUrl
        ? new S3Client({
            region: 'auto',
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            // newer SDKs add CRC32 checksum params that R2 doesn't accept on presigned PUTs
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
          })
        : null;
  }

  // Startup report in the server log: which settings are present (never the secrets)
  // and whether the key can actually reach the bucket. Runs in the background.
  onModuleInit() {
    const { endpoint, accessKeyId, secretAccessKey, bucket, publicUrl } =
      this.cfg;
    if (!this.client) {
      const missing = Object.entries({
        R2_ENDPOINT: endpoint,
        R2_ACCESS_KEY_ID: accessKeyId,
        R2_SECRET_ACCESS_KEY: secretAccessKey,
        R2_BUCKET_NAME: bucket,
        R2_PUBLIC_URL: publicUrl,
      })
        .filter(([, v]) => !v)
        .map(([k]) => k);
      this.logger.warn(
        `Image upload is off, missing env: ${missing.join(', ')}`,
      );
      return;
    }
    this.logger.log(
      `R2 endpoint=${new URL(endpoint!).host} bucket=${bucket} public=${publicUrl} key=${accessKeyId!.slice(0, 4)}…`,
    );
    void this.checkAccess();
  }

  private async checkAccess() {
    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: this.cfg.bucket }));
      this.logger.log(`R2 check OK: key can reach bucket "${this.cfg.bucket}"`);
    } catch (err) {
      const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      const status = e.$metadata?.httpStatusCode;
      const hint =
        status === 403
          ? 'the API token has no access to this bucket: check it is "Object Read & Write", scoped to this bucket, and from the same account as R2_ENDPOINT'
          : status === 404
            ? 'no bucket with this name in that account: check R2_BUCKET_NAME and R2_ENDPOINT'
            : 'could not reach R2: check R2_ENDPOINT and the network';
      this.logger.error(
        `R2 check FAILED (${e.name ?? 'Error'} ${status ?? ''}): ${hint}`,
      );
    }
  }

  isConfigured() {
    return this.client !== null;
  }

  // Type, size and cache headers are part of the signature, so the browser
  // must send exactly these headers and can't swap in a bigger or other file.
  async presignProductImage(contentType: string, size: number) {
    if (!this.client) {
      throw new ServiceUnavailableException('Image upload is not configured');
    }
    const key = productImageKey(contentType, size, randomUUID());
    this.logger.log(`Signed upload ${key} (${contentType}, ${size} bytes)`);
    const headers = {
      'content-type': contentType,
      'cache-control': CACHE_CONTROL,
    };
    const upload_url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.cfg.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        CacheControl: CACHE_CONTROL,
      }),
      {
        expiresIn: UPLOAD_TTL_S,
        signableHeaders: new Set(['content-type', 'content-length', 'cache-control']),
      },
    );
    return {
      upload_url,
      public_url: `${this.cfg.publicUrl}/${key}`,
      headers,
      expires_in: UPLOAD_TTL_S,
    };
  }

  keyFromUrl(url: string | null | undefined) {
    return keyFromUrl(url, this.cfg.publicUrl);
  }

  // Best-effort: a failed delete only leaves an orphan file, never fails the caller.
  async deleteByUrl(url: string | null | undefined) {
    const key = this.keyFromUrl(url);
    if (!key || !this.client) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: key }),
      );
      this.logger.log(`Deleted ${key}`);
    } catch (err) {
      this.logger.warn(`Could not delete ${key}: ${String(err)}`);
    }
  }
}
