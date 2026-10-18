import Joi from "joi"

export const envValidationSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),
    PORT: Joi.number().default(3000),

    DATABASE_URL: Joi.string().required(),

    JWT_SECRET: Joi.string().min(32).required(),
    JWT_EXPIRES_IN: Joi.string().default('10m'),

    HMAC_SECRET: Joi.string().required(),

    // shared with the Next.js BFF; lets it forward the tablet IP for rate limiting. empty = off
    BFF_KEY: Joi.string().min(32).allow('').default(''),

    // comma-separated FE origins, e.g. http://localhost:5173; empty = CORS off
    CORS_ORIGINS: Joi.string().allow('').default(''),

    // requests per minute per IP
    THROTTLE_LIMIT: Joi.number().integer().min(1).default(600),
    LOGIN_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),

    // Cloudflare R2 for product images; leave empty to run without image upload
    R2_ENDPOINT: Joi.string().uri({ scheme: ['https'] }).allow('').optional(),
    R2_ACCESS_KEY_ID: Joi.string().allow('').optional(),
    R2_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),
    R2_BUCKET_NAME: Joi.string().allow('').optional(),
    // public base of the bucket (r2.dev subdomain or custom domain), e.g. https://img.example.com
    R2_PUBLIC_URL: Joi.string().uri({ scheme: ['https'] }).allow('').optional(),

    // GrabFood Partner API; off by default. mock = outbound calls are only logged
    GRAB_ENABLED: Joi.boolean().default(false),
    GRAB_MODE: Joi.string().valid('mock', 'staging', 'production').default('mock'),
    GRAB_CLIENT_ID: Joi.string().allow('').optional(),
    GRAB_CLIENT_SECRET: Joi.string().allow('').optional(),
    GRAB_AUTH_URL: Joi.string().uri({ scheme: ['https'] }).allow('').optional(),
    GRAB_API_BASE_URL: Joi.string().uri({ scheme: ['https'] }).allow('').optional(),
    GRAB_PARTNER_CLIENT_ID: Joi.string().allow('').optional(),
    GRAB_PARTNER_CLIENT_SECRET: Joi.string().allow('').optional(),
    GRAB_WEBHOOK_JWT_SECRET: Joi.string().min(32).allow('').optional(),
    GRAB_MERCHANT_ID: Joi.string().allow('').optional(),
    GRAB_SYSTEM_STAFF_ID: Joi.string().uuid().allow('').optional(),

    // LINE OA + LIFF for the loyalty program; off by default
    LINE_ENABLED: Joi.boolean().default(false),
    LINE_CHANNEL_SECRET: Joi.string().allow('').optional(),
    LINE_CHANNEL_ACCESS_TOKEN: Joi.string().allow('').optional(),
    LINE_LOGIN_CHANNEL_ID: Joi.string().pattern(/^\d+$/).allow('').optional(),

    // Web Push (npx web-push generate-vapid-keys); empty = push off
    VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
    VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),
    VAPID_SUBJECT: Joi.string().pattern(/^(mailto:|https:)/).allow('').optional(),
})
