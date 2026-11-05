# SQLite migrations — archived for Postgres switch

The `deploy-prep` branch flipped Prisma's provider from SQLite to Postgres in
`schema.prisma`. The migration SQL files in this folder were generated against
SQLite (`DATETIME` columns, SQLite-specific INTEGER PK semantics, etc.) and
will not apply cleanly to Postgres.

## What to do on first Postgres deploy

```bash
# 1. Make sure DATABASE_URL points at the new Postgres (Neon Mumbai)
export DATABASE_URL=postgresql://USER:PASS@HOST/DB

# 2. Drop this archive so prisma migrate dev can start fresh
rm -rf prisma/migrations.sqlite-archive
mkdir prisma/migrations

# 3. Generate the first Postgres migration from the current schema
npx prisma migrate dev --name init

# 4. (optional) Run the seed if you want demo data in this environment.
#    In production you usually DON'T want this — create the admin user
#    manually via Prisma Studio or a one-shot script instead.
# npx tsx prisma/seed.ts
```

## Why we don't just rewrite the SQL by hand

The schema is large (Users, Bookings, Subscriptions, Devices, DeviceReading,
Payments, Invoices, Notifications, KYC, Banners, Inquiries, Tickets, Jobs,
PushToken, HelpRequest, WaitlistEntry, AuditLog, RefreshToken, OtpAttempt).
Letting Prisma re-derive the Postgres DDL ensures correct types
(`TIMESTAMP(3)` not `DATETIME`, `TEXT` not `VARCHAR`, native UUID, etc.) and
keeps the migration history clean for future schema changes.

The application code is unchanged — Prisma's query API is provider-agnostic.
