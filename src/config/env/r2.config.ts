import { registerAs } from "@nestjs/config";

// Cloudflare R2 (S3-compatible) for product images. All optional: without them
// the app still runs and image upload answers 503.
export default registerAs('r2', () => ({
    // account endpoint, e.g. https://<account-id>.r2.cloudflarestorage.com
    endpoint: process.env.R2_ENDPOINT?.replace(/\/+$/, ''),
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
    publicUrl: process.env.R2_PUBLIC_URL?.replace(/\/+$/, ''),
}))
