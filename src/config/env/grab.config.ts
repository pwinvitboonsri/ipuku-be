import { registerAs } from "@nestjs/config";

// GrabFood Partner API. Off unless GRAB_ENABLED=true; in mock mode nothing is sent
// to Grab (outbound calls are only logged), so the flow can be tested locally.
export default registerAs('grab', () => ({
    enabled: process.env.GRAB_ENABLED === 'true',
    mode: (process.env.GRAB_MODE ?? 'mock') as 'mock' | 'staging' | 'production',
    // ours, to call Grab
    clientId: process.env.GRAB_CLIENT_ID,
    clientSecret: process.env.GRAB_CLIENT_SECRET,
    authUrl: process.env.GRAB_AUTH_URL?.replace(/\/+$/, ''),
    apiBaseUrl: process.env.GRAB_API_BASE_URL?.replace(/\/+$/, ''),
    // Grab's, to get a token from us before calling our webhooks
    partnerClientId: process.env.GRAB_PARTNER_CLIENT_ID,
    partnerClientSecret: process.env.GRAB_PARTNER_CLIENT_SECRET,
    webhookJwtSecret: process.env.GRAB_WEBHOOK_JWT_SECRET,
    merchantId: process.env.GRAB_MERCHANT_ID,
    // inactive staff row that owns Grab orders, payments and audit rows
    systemStaffId: process.env.GRAB_SYSTEM_STAFF_ID,
}))
