# SmartRO — Free-Tier Testing Deploy Guide

Get all three apps online for testing in ~45 minutes. Zero cost, no credit
card needed for the basic flow.

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Neon (DB)   │◄───┤  Render (API)    │◄───┤  Vercel (Admin)  │
│  Postgres    │    │  Express + Prisma│    │  Next.js         │
└──────────────┘    └──────────────────┘    └──────────────────┘
                            ▲
                            │
                    ┌───────┴────────┐
                    │  Expo Go (app) │
                    │  scan QR code  │
                    └────────────────┘
```

For real production with live SMS/payments, see `Android_SmartRO_Backend/fly.toml`
and the existing `.env.production.example` — that's a separate guide.

---

## Step 0 — Push your code to GitHub

Render and Vercel both deploy from GitHub. If you haven't already:

1. Create a new repo at github.com.
2. From your project root:
   ```bash
   git remote add origin https://github.com/<you>/Android_SmartRO.git
   git push -u origin main
   ```

---

## Step 1 — Postgres on Neon  *(5 min)*

1. Go to **https://neon.tech** → sign up with GitHub.
2. Create a new project.
   - Region: **Singapore** (closest free region to India).
   - Postgres version: latest is fine.
3. Once the project is ready, click **Connection Details** → copy the
   **Pooled connection** string. It looks like:
   ```
   postgresql://user:pass@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Save it somewhere — you'll paste it into Render in Step 2.

✅ Done when you have the `postgresql://…` string.

---

## Step 2 — Backend on Render  *(15 min)*

The repo already has a blueprint at
`Android_SmartRO_Backend/render.yaml` that does most of the work.

1. Go to **https://render.com** → sign up with GitHub.
2. **Dashboard → New → Blueprint**.
3. Pick your `Android_SmartRO` repo. Render will detect `render.yaml`.
4. When it asks for the `DATABASE_URL` value, paste your Neon connection string
   from Step 1. Other secrets (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) are
   auto-generated.
5. Click **Apply** → Render builds and deploys (~5 min).
6. Once "Live", copy the service URL (e.g. `https://smartro-api.onrender.com`).
7. Verify: open `https://smartro-api.onrender.com/health` — should show
   `{"data":{"ok":true,"ts":"…"}}`.

### Seed the database (one-time, from your laptop)

The first deploy created the schema but no data. Seed it once locally —
this creates the admin user, products, pricing, and demo customers:

```bash
cd Android_SmartRO_Backend
npm install
DATABASE_URL="postgresql://…your-neon-url…" npx tsx prisma/seed.ts
```

After it finishes you'll see:
```
Admin login → email: admin@smartro.in   password: Admin@12345
Customers (OTP login, OTP returned in dev response):
  • Priya Mehta  +919876543210
  • Rahul Iyer   +919812345678
  • Aditi Joshi  +919800000001
```

> ⚠️ **Free tier sleeps after 15 min idle.** First request after sleep takes
> ~30 s while the container wakes. To keep it warm, set up a free job at
> [cron-job.org](https://cron-job.org) hitting `/health` every 10 min.

✅ Done when `/health` returns 200 and the seed has run.

---

## Step 3 — Admin dashboard on Vercel  *(10 min)*

1. Go to **https://vercel.com** → sign up with GitHub.
2. **Add New → Project** → import your repo.
3. Configure:
   - **Root Directory:** `Android_SmartRO_Admin`
   - **Framework Preset:** Next.js (auto-detected)
4. Expand **Environment Variables** and add (before clicking Deploy):
   ```
   NEXT_PUBLIC_API_URL = https://smartro-api.onrender.com/api/v1
   ```
   Use **your** Render URL from Step 2. The `/api/v1` suffix is required.
5. Click **Deploy**. ~2 min later you'll get a URL like
   `https://smartro-admin.vercel.app`.
6. Open it, click "Login", and sign in with:
   - Email: `admin@smartro.in`
   - Password: `Admin@12345`

### Lock down CORS (optional, recommended)

Go back to Render → your service → **Environment** → update:
```
CORS_ORIGINS=https://smartro-admin.vercel.app
```
Save. Render redeploys automatically.

✅ Done when you can log into the admin dashboard.

---

## Step 4 — Mobile app via Expo Go  *(10 min)*

The fastest way to test on a real phone — no APK build, no Play Store.

1. Install **Expo Go** on your test phone from Play Store / App Store.
2. Edit `Android_SmartRO_Frontend/app.json` → change the API URL to your
   Render backend:
   ```json
   "extra": {
     "apiBaseUrl": "https://smartro-api.onrender.com/api/v1"
   }
   ```
3. From your laptop:
   ```bash
   cd Android_SmartRO_Frontend
   npm install
   npx expo start --tunnel
   ```
   `--tunnel` lets your phone connect even if it's on a different Wi-Fi.
4. Scan the QR code:
   - **Android** → with the Expo Go app
   - **iOS** → with the Camera app
5. The app loads in ~30 s. Test the OTP login with `+919876543210`
   (Priya Mehta) — since `OTP_DEV_RETURN=true`, the OTP comes back in the
   API response (visible in the Expo terminal).

### If you need a shareable APK instead

EAS free tier gives 30 builds/month — generates an installable APK you can
share with testers:

```bash
npm install -g eas-cli
eas login
cd Android_SmartRO_Frontend

# Edit eas.json — change "preview" profile's EXPO_PUBLIC_API_URL to your
# Render URL (currently set to https://api.smartro.in/api/v1).

eas build --profile preview --platform android
```

After ~15 min you get a download link. Testers install it like any APK.

✅ Done when you can log in on your phone and see the home screen.

---

## Demo accounts (created by the seed)

| Role | Login | Credential |
|---|---|---|
| Admin | `admin@smartro.in` | password: `Admin@12345` |
| Technician 1 | `tech1@smartro.in` | password: `Tech@12345` |
| Technician 2 | `tech2@smartro.in` | password: `Tech@12345` |
| Customer (active sub) | `+919876543210` Priya | OTP returned in API response |
| Customer (pending KYC) | `+919812345678` Rahul | OTP returned in API response |
| Customer (inquiry only) | `+919800000001` Aditi | OTP returned in API response |

Seeded cities: **Pune**, **Mumbai** (active), **Bangalore** (waitlist-only).

---

## Troubleshooting

**Render build fails on `prisma db push`**
→ Check the `DATABASE_URL` you pasted has `?sslmode=require` at the end.

**Admin login returns "Network Error"**
→ `NEXT_PUBLIC_API_URL` is baked in at build time. After changing it in
Vercel, you must **redeploy** the admin (Vercel → Deployments → "…" →
Redeploy).

**Mobile app can't reach the backend**
→ Check `app.json` → `extra.apiBaseUrl` points to your Render URL with
`/api/v1` suffix. After editing `app.json`, stop and restart `expo start`.

**Backend is slow on first request**
→ Free Render web services sleep after 15 min idle. The first request takes
~30 s to wake. Ping `/health` every 10 min with cron-job.org to keep it warm.

**Admin shows CORS errors in browser console**
→ Make sure `CORS_ORIGINS` on Render includes your Vercel URL (or is `*`
for testing).

**Re-deploying the backend wipes my seed data**
→ `prisma db push` keeps data across deploys, but if the schema changed
incompatibly Render will fail with a destructive-change error. To force-reset
on testing only, the build command already passes `--accept-data-loss`. To
re-seed afterwards, run the seed command from Step 2 again.

---

## What's NOT included in this testing setup

These are intentionally stubbed because they need paid third-party accounts.
Don't enable them until you're going to real production.

- **Razorpay payments** — `PAYMENT_DRIVER=stub` simulates payment success/failure.
- **Real SMS via MSG91** — `MESSAGING_DRIVER=stub` logs OTPs to the API
  response instead of sending SMS.
- **Expo Push notifications** — `PUSH_DRIVER=stub` logs to console only.
- **Persistent file uploads** — Render free tier has no persistent disk, so
  uploaded files (invoice PDFs, KYC images) are lost on each redeploy. Fine
  for testing.

See `Android_SmartRO_Backend/.env.production.example` for the real-prod
template (Fly.io + Razorpay + MSG91 + Expo).
