import { registerAs } from "@nestjs/config";

// LINE OA (Messaging API) + LIFF login. Off unless LINE_ENABLED=true.
// All three channels must sit under one LINE Provider so userIds match.
export default registerAs('line', () => ({
    enabled: process.env.LINE_ENABLED === 'true',
    // Messaging API channel: signs webhooks, sends push/reply messages
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    // LINE Login channel that owns the LIFF app: audience of LIFF ID tokens
    loginChannelId: process.env.LINE_LOGIN_CHANNEL_ID,
}))
