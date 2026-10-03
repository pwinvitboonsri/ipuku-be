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
})