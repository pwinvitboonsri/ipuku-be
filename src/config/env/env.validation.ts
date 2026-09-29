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

    // comma-separated FE origins, e.g. http://localhost:5173; empty = CORS off
    CORS_ORIGINS: Joi.string().allow('').default(''),

    // requests per minute per IP
    THROTTLE_LIMIT: Joi.number().integer().min(1).default(600),
    LOGIN_THROTTLE_LIMIT: Joi.number().integer().min(1).default(10),
})