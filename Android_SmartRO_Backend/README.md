# SmartRO Backend

Node.js + Express + Prisma + SQLite + JWT.

## Quick start

```bash
cd Android_SmartRO_Backend
npm install
SEED_ADMIN_PASSWORD=... SEED_TECH_PASSWORD=... npm run setup   # migrate + seed
npm run dev             # starts on http://localhost:4000
```

Health check: `curl http://localhost:4000/health`

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start with hot-reload (tsx watch) |
| `npm run build` | TypeScript compile to `dist/` |
| `npm start` | Run compiled `dist/server.js` |
| `npm run typecheck` | TypeScript check, no emit |
| `npm test` | vitest |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:seed` | Wipe + seed demo data |
| `npm run prisma:reset` | Drop DB, re-migrate, re-seed |
| `npm run prisma:studio` | Open Prisma Studio at http://localhost:5555 |
| `npm run setup` | Migrate + seed (one-shot first-time setup) |

## Demo credentials

After `npm run setup`:

- Admin (web): `admin@smartro.in` / `$SEED_ADMIN_PASSWORD`
- Technician 1: `tech1@smartro.in` / `$SEED_TECH_PASSWORD` (phone `+919999911111`)
- Technician 2: `tech2@smartro.in` / `$SEED_TECH_PASSWORD`
- Customer (OTP login): `+919876543210` (Priya — has active subscription)
- Customer: `+919812345678` (Rahul — booking pending KYC)
- Customer: `+919800000001` (Aditi — inquiry only)

In dev, OTP is returned in the response body of `/api/v1/auth/otp/request` (`devOtp`).

## API base URL

`http://localhost:4000/api/v1`

Mobile-app on physical device: replace `localhost` with your Mac's LAN IP (run
`ipconfig getifaddr en0`) in the apps' `src/api/client.ts`.

## Razorpay payments

`PAYMENT_DRIVER` picks the gateway. `stub` (the default) needs no account: the
app calls `POST /bookings/:id/pay` and `POST /subscriptions/:id/recharge`,
which mark the payment paid after `PAYMENT_STUB_DELAY_MS`. With `razorpay` the
app opens Razorpay Checkout instead. It asks `GET /api/v1/payments/config`
which driver is on.

### 1. Get test keys

Start in Test Mode. No real money moves.

1. Razorpay Dashboard → switch on **Test Mode** → **Account & Settings → API
   Keys** → **Generate Key**.
2. The Key ID starts with `rzp_test_`. The Key Secret is shown **once**, so
   copy it now. If you lose it, regenerate the key.

### 2. Set `.env`

```env
PAYMENT_DRIVER=razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=any-long-random-string
```

`RAZORPAY_WEBHOOK_SECRET` must match the secret you give the webhook in step 3.

Restart the backend after editing `.env` (Ctrl+C, then `npm run dev`).
`tsx watch` reloads on code changes, not on `.env` changes. To check it worked,
call `GET /api/v1/payments/config` as a signed-in customer. It should return
`{"data":{"driver":"razorpay","keyId":"rzp_test_…"}}`.

Generate a secret with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

### 3. Add the webhook

Dashboard (still in Test Mode) → **Account & Settings → Webhooks → Add New
Webhook**:

- **URL:** `https://<your-api-host>/api/v1/webhooks/razorpay`
- **Secret:** the same value as `RAZORPAY_WEBHOOK_SECRET`
- **Active events:** `payment.captured`, `order.paid`, `payment.failed`,
  `subscription.authenticated`, `subscription.activated`,
  `subscription.charged`, `subscription.paused`, `subscription.halted`,
  `subscription.cancelled`, `refund.processed`

Razorpay can't reach `localhost`. For local testing, either:

- **Open a tunnel** and use its HTTPS URL as the webhook host:
  `ngrok http 4000` or `cloudflared tunnel --url http://localhost:4000`. The
  URL changes on every run, so update the webhook each time.
- **Skip the webhook.** The app's `POST /payments/verify` call still settles
  one-time payments (deposit, recharge). Autopay events and refund
  confirmations only arrive by webhook.

### 4. Make test payments

| Method | Enter | Result |
|---|---|---|
| Card | `4100 2800 0000 1007`, any future expiry, any CVV | Success |
| UPI | `success@razorpay` | Success |
| UPI | `failure@razorpay` | Failure |
| Netbanking | any bank | Mock bank page: click **Success** or **Failure** |

> ⚠️ In test mode, cancelling a UPI payment counts as a **success**. Use
> `failure@razorpay` to test the failure path.

Paid rows show up in Dashboard → **Transactions → Payments**. In the database,
`Payment.gatewayRef` holds the order id (`order_…`) and
`Payment.gatewayPaymentId` holds the payment id (`pay_…`).

### 5. Customer app

- **Web:** `npm run web` in `Android_SmartRO_Frontend` loads Razorpay
  `checkout.js`. It works straight away.
- **Android/iOS:** Checkout uses `react-native-razorpay`, a native module, so it
  does **not** run in Expo Go. Make a new native build:
  `eas build --profile development -p android`. The `development` profile
  needs `expo-dev-client` (`npx expo install expo-dev-client`; EAS offers to
  add it). `--profile lan` or `--profile preview` give a plain APK instead.

### Refunds

When a customer cancels a subscription, the backend queues a `REFUND` payment
as `INITIATED`. It does **not** call Razorpay's refund API. To pay the refund,
open the original payment in Dashboard → **Transactions → Payments** and click
**Refund**. When `refund.processed` arrives, the queued row is marked
`SUCCESS`.

### Going live

1. Complete Razorpay account activation, switch to **Live Mode**, and generate
   live keys (`rzp_live_…`).
2. On the server, set `PAYMENT_DRIVER=razorpay`, the live `RAZORPAY_KEY_ID` and
   `RAZORPAY_KEY_SECRET`, and `NODE_ENV=production`.
3. Add the webhook again **in Live Mode** (test and live webhooks are
   separate). Give it a new secret and put that in `RAZORPAY_WEBHOOK_SECRET`.
4. With `NODE_ENV=production` the stub routes refuse to run (they return
   `503 PAYMENTS_UNAVAILABLE`), so nobody can mark a booking paid without
   Razorpay.

Template: `.env.production.example`.

## Stack

- TypeScript, Express 4, Prisma 5, SQLite (dev), JWT, Zod, bcrypt, vitest+supertest
- Single `buildApp()` factory in `src/app.ts` so tests reuse exactly the prod wiring
- Modules consolidate routes + schema + handlers in one file each — no over-abstraction

## Switching to Postgres

Change `provider = "sqlite"` to `provider = "postgresql"` in
`prisma/schema.prisma`, set `DATABASE_URL` to a Postgres URL, then
`npx prisma migrate dev --name init`. No application-code changes.
