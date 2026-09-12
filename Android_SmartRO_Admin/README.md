# SmartRO — Admin Console

Next.js 14 (App Router) + TypeScript + Tailwind.

## Quick start

```bash
cd Android_SmartRO_Admin
npm install
npm run dev          # http://localhost:3000
```

**Backend must be running first** (`Android_SmartRO_Backend`).

## Demo login

`admin@smartro.in` / the password you seeded with (`SEED_ADMIN_PASSWORD`)

## Pages

| Path | What it does |
|---|---|
| `/login` | Email + password sign-in (TOTP 2FA is doc-spec, not in prototype) |
| `/dashboard` | KPIs: active subs, open tickets, revenue this month, devices by status |
| `/inquiries` | Lead inbox; filter by status; one-click status transitions |
| `/bookings` | All customer bookings with totals + status |
| `/subscriptions` | Active subscriptions with expiry tracking |
| `/customers` | Customer 360 view (addresses, subscriptions, KYC) |
| `/tickets` | Service tickets — assign technicians, transition statuses |
| `/technicians` | Roster |

## Notes

- All data comes from backend `/api/v1/admin/*` endpoints (admin role required).
- TOTP 2FA, audit-log viewer, and bulk actions are doc-spec but deferred to Phase 2.
