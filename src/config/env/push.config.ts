import { registerAs } from "@nestjs/config";

// Web Push (VAPID). All optional: without them push is off and the app still runs.
export default registerAs('push', () => ({
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
}))
