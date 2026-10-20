# GrabFood integration (in-house POS)

Step-by-step plan for connecting ipuku's NestJS API to the GrabFood Merchant Integration API (Partner API).

Grab and the POS talk in two directions:

```
Grab ──(webhooks: new order, order state)──▶  NestJS  /v1/grab/*
Grab ◀──(API calls: accept, ready, menu…)───  NestJS  GrabClient
```

Reference: Grab's official SDKs. [grabfood-api-sdk-go](https://github.com/grab/grabfood-api-sdk-go) has the endpoint list and models; the Java and Python SDKs are the same.

---

## Step 0: Before writing code

1. **Register at developer.grab.com** and create an app for GrabFood with the scope `food.partner_api`. This gives the sandbox `client_id` and `client_secret`.
2. **Get the café's Grab Merchant ID.** It's in the GrabMerchant app profile.
3. **Get a public HTTPS URL** for local NestJS so Grab can reach it, e.g. `ngrok http 3000` gives `https://xxxx.ngrok.app`.
### Who gets developer.grab.com access

- The developer portal account belongs to **the integrator (us)**, not the café. The owner's GrabMerchant login doesn't include it, so asking for the owner's merchant access won't help here.
- **We sign up ourselves**, then request the GrabFood API. Grab reviews that request, so it may ask for business details.
- **What to ask the owner for:**
  - the business details Grab may ask for (registered shop/company name, tax ID, contact), so the request is made on the café's behalf;
  - an introduction to the café's **Grab account manager**, who can tell us whether a single store's in-house POS is accepted in Thailand and can push the request internally.
- Not confirmed yet: whether sign-up is open to anyone or needs an invite/approval first.

4. **ID rule:** the menu sent to Grab uses our own `product.id` and `modifier_option.id`. Grab sends those same IDs back in every order (`items[].id` is "the item's externalID in the partner system"), so no mapping table is needed.

## Step 1: Config

- Env keys for calling Grab:
  - `GRAB_CLIENT_ID`, `GRAB_CLIENT_SECRET`
  - `GRAB_AUTH_URL=https://api.grab.com/grabid/v1/oauth2/token`
  - `GRAB_API_BASE_URL=https://partner-api.grab.com/grabfood-sandbox` (production later: `https://partner-api.grab.com/grabfood`)
  - `GRAB_MERCHANT_ID`
- Env keys for Grab calling us: `GRAB_PARTNER_CLIENT_ID`, `GRAB_PARTNER_CLIENT_SECRET`, `GRAB_WEBHOOK_JWT_SECRET`.
- Load them with `registerAs('grab', …)` and validate them with Joi, like the other configs.

## Step 2: Outbound client (calling Grab)

`GrabClient` service:
- gets a token with `POST GRAB_AUTH_URL` (`grant_type=client_credentials`, `scope=food.partner_api`);
- caches the token until about a minute before `expires_in`;
- sends `Authorization: Bearer <token>` and `Content-Type: application/json` on every call.

The first calls needed:

| Purpose | Endpoint |
|---|---|
| Accept or reject an order | `POST /partner/v1/order/prepare` `{ orderID, toState }` |
| Food is ready | `POST /partner/v1/orders/mark` `{ orderID, markStatus: 1 }` |
| "Menu changed, pull it again" | `POST /partner/v1/merchant/menu/notification` `{ merchantID }` |

Also available later: cancel, refund, pause store, store hours, update item availability, list orders.

Add a `mock` mode that only logs, so everything can be built before credentials exist.

## Step 3: Inbound auth (Grab calling us)

1. `POST /grab/oauth/token`: Grab sends our partner client ID and secret. Check them and return `{ access_token, token_type: "Bearer", expires_in }`, signed with its own secret (not the staff JWT secret).
2. Add a `GrabWebhookGuard` on every webhook route that verifies that Bearer token.
3. Add `@SkipThrottle()` on webhook routes so Grab never gets rate-limited.
4. Don't let the global `ValidationPipe` (which has `forbidNonWhitelisted`) reject Grab bodies. Take the body as a plain object and validate it with `whitelist` only. Otherwise every webhook starts failing with 400s the day Grab adds a new field.

## Step 4: Menu endpoint (Grab pulls)

`GET /grab/merchant/menu` returns the menu in Grab's shape:
- top level: `currency`, `sellingTimes`, `categories`
- each category: `items`
- each item: `modifierGroups` (`selectionRangeMin` / `selectionRangeMax`), each with `modifiers`

Prices are in **satang** (minor units). Mark out-of-stock items as `UNAVAILABLE`.

## Step 5: New-order webhook (the core)

`POST /grab/orders` receives `orderID`, `shortOrderNumber`, `merchantID`, `items[]` (each with `id`, `quantity`, `modifiers[]`), `price.subtotal`, and `featureFlags.orderAcceptedType`. Then:

1. **Make it idempotent:** save `orderID` in a table with a unique constraint *first*. If it already exists, it's a retry from Grab, so return 200 and do nothing else.
2. Map the items to the normal create-order input and create the order through the **existing `OrderService`**, so validation, prices and snapshots are shared with the counter.
3. Pay it with a `GRAB` payment type so stock is deducted and it never counts toward the cash drawer.
4. If `orderAcceptedType` is `MANUAL`, call accept. If the order can't be made (no shift open, inactive item), call reject.
5. **Always answer 200 quickly.** Only return 500 for real crashes, because a 500 makes Grab retry.

## Step 6: Order-state webhook

`PUT /grab/orders/state` receives `{ orderID, state }`, e.g. `DRIVER_ALLOCATED`, `COLLECTED`, `DELIVERED`, `CANCELLED`. Store the state. On `CANCELLED`, refund or void the order in the POS.

## Step 7: Test locally

1. **Simulator script** that plays Grab: get a token, `GET` the menu, `POST` an order twice, then send `CANCELLED`. Check the DB each time.
2. **Unit tests** on the pure parts: payload→items mapping and menu mapping.

## Step 8: Sandbox with Grab

1. Start ngrok, then register the URLs in the Grab developer portal:
   - token: `https://xxxx.ngrok.app/v1/grab/oauth/token`
   - menu: `/v1/grab/merchant/menu`
   - orders: `/v1/grab/orders`
   - state: `/v1/grab/orders/state`
2. Switch from `mock` to the sandbox URLs and credentials, place test orders from Grab's sandbox, and fix any field differences.

## Step 9: Go live

1. Grab reviews the integration.
2. Link the café: `POST /partner/v1/self-serve/activation` returns an activation link, and the owner opens it to connect the store.
3. Switch to the production URL, deploy, and register the production URLs.

---

## Status

- Steps 1–7 are built in `src/grab/` (DTOs in `src/grab/dto/`, client in `src/grab/grab.client.ts`; simulator: `npm run grab:simulate`).
- Blocker: Step 0, sandbox credentials from developer.grab.com.
- Not confirmed yet: whether Grab Thailand approves a single café's own in-house POS. Grab's merchant guide only points stores to approved POS partners such as Klikit.

## Notes

<!-- Discussion notes go here. -->
