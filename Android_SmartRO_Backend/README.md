# SmartRO Backend

Node.js + Express + Prisma + SQLite + JWT.

## Quick start

```bash
cd Android_SmartRO_Backend
npm install
npm run setup           # runs prisma migrate dev + seed
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

- Admin (web): `admin@smartro.in` / `Admin@12345`
- Technician 1: `tech1@smartro.in` / `Tech@12345` (phone `+919999911111`)
- Technician 2: `tech2@smartro.in` / `Tech@12345`
- Customer (OTP login): `+919876543210` (Priya — has active subscription)
- Customer: `+919812345678` (Rahul — booking pending KYC)
- Customer: `+919800000001` (Aditi — inquiry only)

In dev, OTP is returned in the response body of `/api/v1/auth/otp/request` (`devOtp`).

## API base URL

`http://localhost:4000/api/v1`

Mobile-app on physical device: replace `localhost` with your Mac's LAN IP (run
`ipconfig getifaddr en0`) in the apps' `src/api/client.ts`.

## Stack

- TypeScript, Express 4, Prisma 5, SQLite (dev), JWT, Zod, bcrypt, vitest+supertest
- Single `buildApp()` factory in `src/app.ts` so tests reuse exactly the prod wiring
- Modules consolidate routes + schema + handlers in one file each — no over-abstraction

## Switching to Postgres

Change `provider = "sqlite"` to `provider = "postgresql"` in
`prisma/schema.prisma`, set `DATABASE_URL` to a Postgres URL, then
`npx prisma migrate dev --name init`. No application-code changes.
