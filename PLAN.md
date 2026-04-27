# SmartRO — Implementation Plan

## 1. Product context (from your docs)

SmartRO is a **water purifier rental subscription platform** for India.
Customers pay a monthly fee instead of buying a purifier outright (~₹15–30k upfront).
The fee bundles device + installation + maintenance + filter replacement + on-call service.

The platform comprises:
- **Customer mobile app** — browse, book, recharge, raise tickets, manage profile
- **Technician mobile app** — today's jobs, navigation, checklists, QR scan, e-signature, offline-first
- **Admin web panel** — inquiries, bookings, subscriptions, devices, tickets, technicians, reports

(Source: SmartRO_Planning_Requirements_Document.docx, SmartRO_Solution_Blueprint.docx,
SmartRO_System_Architecture_Design.docx, SmartRO_Database_Design.docx — all read end-to-end.)

## 2. Tech stack chosen

| Layer | Tech | Why |
|---|---|---|
| Backend | Node.js 20 + TypeScript + Express | User asked for separate backend folder; matches doc's "Node/TS or Python" choice; widely deployable |
| ORM | Prisma | Doc-mandated; type-safe; easy migrations + seed |
| Database | SQLite (local dev) → Postgres-ready | Doc spec is Postgres 15 — but SQLite lets you `npm install && npm run dev` with **zero setup**, log in, click around. Prisma schema is written so you can switch the datasource to `postgresql` and run `prisma migrate` with no other code changes |
| Auth | JWT (15-min access + 30-day refresh), OTP login (dev: OTP returned in API response so you can log in without an SMS provider) | Matches doc spec |
| Validation | Zod | Doc-suggested |
| Mobile (Customer) | React Native via Expo (TypeScript) | **You explicitly said React Native, iOS + Android.** Expo gives one codebase for both platforms with no Xcode/Android Studio setup |
| Mobile (Technician) | React Native via Expo (TypeScript) | Same reason; shares API client + design system with customer app |
| Admin web | Next.js 14 (App Router) + TypeScript + Tailwind + shadcn-style components | Doc-mandated framework |
| Mobile state | Zustand + TanStack Query | Lightweight; doc-friendly |
| HTTP client | axios with auth interceptor | Standard |
| Storage (KYC, photos) | Local filesystem + signed URL stub (`/api/files/...`) | S3 in prod; local for now |
| Payments | Stub gateway that auto-marks "PAID" after 1.5s | No paid keys provided. Adapter pattern matches doc; swap in Razorpay later |
| Seed | Prisma seed script | 2 cities, 5 products, 4 plan durations, city-specific pricing, 3 customers, 2 technicians, 1 admin, sample inquiries/bookings/subscriptions/tickets/devices |

## 3. Folder structure (top-level)

```
Android_SmartRO/
├── PLAN.md                           ← this file
├── STATUS.md                         ← created at end
├── Android_SmartRO_Backend/          ← Node + Express + Prisma + SQLite
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── modules/{auth,catalog,inquiry,booking,kyc,subscription,
│   │   │            payment,device,ticket,technician,admin,notification}/
│   │   │   ├── *.controller.ts
│   │   │   ├── *.service.ts
│   │   │   ├── *.routes.ts
│   │   │   └── *.schema.ts            (Zod)
│   │   ├── core/{auth,errors,logger,prisma,validate}.ts
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/                        (vitest + supertest)
│   ├── .env / .env.example
│   ├── package.json / tsconfig.json
│   └── README.md
├── Android_SmartRO_Frontend/         ← Customer RN app (Expo)
│   ├── App.tsx
│   ├── app.json
│   ├── src/
│   │   ├── screens/{Auth,Home,Catalog,ProductDetail,Inquiry,Booking,
│   │   │            MyPlan,Tickets,Profile}/
│   │   ├── navigation/
│   │   ├── api/                     (axios + endpoints)
│   │   ├── store/                   (Zustand)
│   │   ├── components/
│   │   ├── theme/
│   │   └── utils/
│   ├── package.json
│   └── README.md
├── Android_SmartRO_Technician/       ← Technician RN app (Expo) — new folder
│   ├── App.tsx
│   ├── src/
│   │   ├── screens/{Auth,Jobs,JobDetail,Profile}/
│   │   ├── navigation/
│   │   ├── api/, store/, components/, theme/
│   ├── package.json
│   └── README.md
└── Android_SmartRO_Admin/            ← Admin web (Next.js)
    ├── app/
    │   ├── login/, dashboard/, inquiries/, bookings/,
    │   │ subscriptions/, customers/, devices/, technicians/, tickets/, reports/
    │   └── layout.tsx, globals.css
    ├── components/ui/                (button, card, input, table, badge, dialog)
    ├── lib/{api.ts, auth.ts, utils.ts}
    ├── package.json / next.config.js / tailwind.config.ts / tsconfig.json
    └── README.md
```

## 4. Data model (Prisma schema, condensed)

Mapped from SmartRO_Database_Design.docx but simplified to MVP-of-MVP.
Money stored in **paise (integer)** to match doc convention.

```
User            id, kind(CUSTOMER|ADMIN|TECHNICIAN), phone, email, passwordHash?,
                fullName, status, referralCode, createdAt
Address         id, userId, label, line1, line2, cityId, pincode, lat, lng, isDefault
City            id, name, state, isServiceable
Product         id, name, slug, kind(HOME|COMMERCIAL), capacityLitres, technology,
                mounting, description, imageUrl, isActive
Plan            id, name, durationDays
PlanCityPrice   id, planId, cityId, productId, monthlyPricePaise, depositPaise,
                effectiveFrom
Inquiry         id, userId?, name, phone, pincode, cityId, productId?, planId?,
                preferredSlot, notes, status(NEW|CONTACTED|PROPOSAL_SENT|BOOKED|LOST),
                createdAt
InquiryEvent    id, inquiryId, actorUserId, type, payload(json), createdAt
Booking         id, userId, productId, planId, cityId, addressId, depositPaise,
                firstPaymentPaise, status(PENDING_KYC|PENDING_PAY|PAID|INSTALLED|CANCELLED),
                installationSlot, agreementSignedAt, createdAt
Payment         id, userId, bookingId?, subscriptionId?, amountPaise, kind(DEPOSIT|RECHARGE|REFUND),
                status(INITIATED|SUCCESS|FAILED), gatewayRef, createdAt
Invoice         id, paymentId, number, amountPaise, gstPaise, pdfUrl?, createdAt
Subscription    id, userId, bookingId, productId, planId, deviceId?, status(ACTIVE|GRACE|SUSPENDED|CLOSED),
                expiresAt, lockInUntil, createdAt
Device          id, serial, qr, productId, status(WAREHOUSE|ALLOCATED|INSTALLED|IN_SERVICE|RETURNED|RETIRED),
                currentSubscriptionId?, createdAt
Ticket          id, userId, subscriptionId?, deviceId?, category(INSTALL|REPAIR|FILTER|PICKUP|OTHER),
                description, status(OPEN|ASSIGNED|IN_PROGRESS|RESOLVED|CLOSED|REOPENED),
                priority, technicianId?, slaDueAt, rating?, createdAt
Technician      id, userId, employeeCode, zone, isActive
Job             id, ticketId?, bookingId?, technicianId, type(INSTALL|SERVICE|FILTER|PICKUP),
                scheduledFor, status(SCHEDULED|EN_ROUTE|IN_PROGRESS|DONE|CANCELLED),
                notes, completedAt
KycRecord       id, userId, aadhaarMasked, panNumber, selfieUrl, status(PENDING|VERIFIED|REJECTED),
                verifiedAt
Notification    id, userId, channel(PUSH|SMS|EMAIL|INAPP), title, body, readAt, createdAt
AuditLog        id, actorUserId, action, entity, entityId, before(json), after(json), createdAt
```

## 5. API endpoints (REST, all under `/api/v1`)

**Auth**
- POST /auth/otp/request   {phone}                → {otp} (dev only)
- POST /auth/otp/verify    {phone, otp}           → {accessToken, refreshToken, user}
- POST /auth/admin/login   {email, password}      → tokens
- POST /auth/refresh       {refreshToken}         → tokens
- POST /auth/logout
- GET  /auth/me

**Catalog**
- GET  /cities
- GET  /products?cityId=&kind=
- GET  /products/:slug
- GET  /plans?productId=&cityId=

**Inquiry**
- POST /inquiries
- GET  /inquiries (admin)
- PATCH /inquiries/:id/status (admin)
- POST /inquiries/:id/convert-to-booking (admin)

**Booking**
- POST /bookings
- GET  /bookings/me
- GET  /bookings/:id
- POST /bookings/:id/sign-agreement
- POST /bookings/:id/pay  (initiates stub payment, returns 200 after 1.5s)

**KYC**
- POST /kyc                {aadhaarLast4, pan, selfieData}
- GET  /kyc/me
- PATCH /kyc/:id/status   (admin)

**Subscription**
- GET  /subscriptions/me
- POST /subscriptions/:id/recharge

**Tickets**
- POST /tickets
- GET  /tickets/me
- GET  /tickets (admin / technician scope)
- PATCH /tickets/:id

**Devices** (admin)
- GET/POST/PATCH /devices

**Technician**
- GET /technician/jobs/today
- PATCH /technician/jobs/:id/status

**Admin**
- GET /admin/dashboard/stats
- GET /admin/users
- GET /admin/audit-logs

## 6. Customer mobile screens

1. Splash → 2. Login (phone) → 3. OTP → 4. Profile setup
5. Home (city select, featured products)
6. Catalog (filters: capacity, technology, mounting, price)
7. Product Detail (carousel, plans, FAQ)
8. Submit Inquiry / Start Booking
9. KYC (Aadhaar last-4 + PAN + selfie placeholder)
10. Agreement Sign
11. Payment Stub
12. Booking Success
13. My Plan (active subscription, expiry, recharge CTA)
14. Tickets (list + raise new)
15. Ticket Detail
16. Profile / Logout

## 7. Technician mobile screens

1. Login (phone) → OTP
2. Today's Jobs list
3. Job Detail (checklist, mark in-progress, mark done with notes)
4. Profile

## 8. Admin web pages

1. /login (email + password)
2. /dashboard (KPIs: active subs, today's revenue, open tickets, pending inquiries)
3. /inquiries
4. /bookings
5. /subscriptions
6. /customers
7. /devices
8. /technicians
9. /tickets
10. /reports (placeholder)

## 9. Build order (smallest viable increments, commit after each)

1. Init monorepo-style root, .gitignore, git init, commit PLAN.md
2. Backend: scaffold + Prisma schema + migrate + seed → commit
3. Backend: auth module (OTP request/verify, admin login, JWT, refresh) → commit
4. Backend: catalog (cities, products, plans, pricing) → commit
5. Backend: inquiry + booking + payment stub + subscription create → commit
6. Backend: tickets + jobs + technician endpoints → commit
7. Backend: admin endpoints + dashboard stats → commit
8. Backend: vitest tests for critical routes → commit
9. Customer RN app: scaffold + nav + auth + catalog + product detail → commit
10. Customer RN app: booking + kyc + payment + my plan + tickets → commit
11. Technician RN app: scaffold + auth + jobs + job detail → commit
12. Admin web: scaffold + login + dashboard + inquiries → commit
13. Admin web: bookings + subscriptions + tickets + customers → commit
14. End-to-end smoke test (curl + RN running) + STATUS.md → commit

## 10. Assumptions (because requirements were ambiguous or external)

1. **Database**: docs say Postgres 15. I'm using SQLite for dev — switching is a one-line `datasource` change in `schema.prisma` + `prisma migrate`. No application code changes.
2. **Mobile framework**: docs prefer Flutter; user explicitly chose React Native. **User instruction wins.** Using Expo SDK 51.
3. **OTP delivery**: no SMS provider keys provided. Dev mode returns `{otp}` in the API response for `/auth/otp/request` so you can log in. Marked `// TODO PROD: integrate MSG91/Gupshup` in the code.
4. **Payment gateway**: no Razorpay keys. `/bookings/:id/pay` simulates a 1.5-second gateway round-trip and marks the payment SUCCESS. Marked `// TODO PROD: integrate Razorpay`. Adapter interface is in place.
5. **KYC**: no DigiLocker / NSDL access. KYC submission stores entered fields + a placeholder selfie URL and goes into a "pending" queue admin can manually verify. Marked TODO.
6. **Push notifications**: in-app notification table exists; FCM not wired (needs Google project). Marked TODO.
7. **Maps / GPS**: city dropdown only; no live geocoding (would need Google Maps key).
8. **WhatsApp / SMS / Email**: stubbed; events written to `Notification` table with `INAPP` channel.
9. **Cities included in seed**: Pune, Mumbai (so you have multi-city pricing to demonstrate).
10. **Currency**: INR; stored as paise (integer) per doc convention.
11. **Lock-in period**: defaulted to 6 months.
12. **Plan durations**: 1 / 3 / 6 / 12 months.
13. **Number of products**: 5 demo products (3 home, 2 commercial).
14. **Admin password in seed**: `Admin@12345` for `admin@smartro.in` — clearly marked, change before any deployment.
15. **iOS specifics**: Expo Go runs the customer + technician apps on iOS without Xcode. For a true `.ipa` build you'd need EAS/Apple Developer account.
16. **Emulator vs phone**: assumed Expo Go on phone or Android emulator if installed. README will say so.
17. **Backend port**: 4000.
18. **Customer app API base URL**: `http://localhost:4000/api/v1` for emulator; instructions in README for using `<your-LAN-IP>:4000` from a physical device.

## 11. Verification plan (per doc Step 4)

- After backend scaffold: `npm run build`, `npm run lint`, `npm run typecheck` clean.
- After each route added: `npm test` runs vitest with supertest hitting the route; assert 200 + shape.
- After full backend: curl every endpoint, paste outputs in STATUS.md.
- After RN apps: `expo start` cleanly; navigation between screens works on web preview (since I can't run an emulator headlessly, web preview verifies render + API calls).
- After admin web: `npm run build` + `npm run dev`, click through every page.

## 12. What is OUT of scope for this overnight build

- Real OTP / SMS / WhatsApp / Email
- Real payment gateway
- Real KYC vendor (DigiLocker / NSDL / IDfy)
- Real push notifications (FCM)
- Real maps / geocoding
- IoT / telemetry (doc Phase 3)
- Auto-renew / UPI Autopay (doc Phase 2)
- Multi-language (doc Phase 2)
- Production deployment / Terraform / CI/CD
- Pen-test / security audit
- Refer & Earn module
- Pause/Resume subscription

These are all explicitly Phase 2 / Phase 3 in the docs.
