-- Livpure-parity feature pack (gap-analysis items 1-10).
-- Already applied via `prisma db push` in dev; this file is for production parity
-- when the project migrates to Postgres (provider switch in schema.prisma).

-- User: referral, referredByCode, rewardPaise
ALTER TABLE "User" ADD COLUMN "referredByCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referralRewardPaise" INTEGER NOT NULL DEFAULT 0;

-- Product: household-size positioning + marketing tag + price rollup
ALTER TABLE "Product" ADD COLUMN "personasMin" INTEGER;
ALTER TABLE "Product" ADD COLUMN "personasMax" INTEGER;
ALTER TABLE "Product" ADD COLUMN "tag" TEXT;
ALTER TABLE "Product" ADD COLUMN "lowestMonthlyPaise" INTEGER;

-- Booking: 7-day trial, cancel, referral credit
ALTER TABLE "Booking" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Booking" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Booking" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "Booking" ADD COLUMN "referralCreditPaise" INTEGER NOT NULL DEFAULT 0;

-- Subscription: trial / pause / cancel / autopay (Razorpay mandate)
ALTER TABLE "Subscription" ADD COLUMN "trialEndsAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "pausedAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "resumedAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "autopayId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "autopayStatus" TEXT;

-- Device: telemetry rollups
ALTER TABLE "Device" ADD COLUMN "lastTdsPpm" INTEGER;
ALTER TABLE "Device" ADD COLUMN "filterLifePct" INTEGER;
ALTER TABLE "Device" ADD COLUMN "usageLitresTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Device" ADD COLUMN "leakDetectedAt" DATETIME;

-- Job: bookingId for INSTALL jobs raised at booking confirm
ALTER TABLE "Job" ADD COLUMN "bookingId" TEXT REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Job_bookingId_idx" ON "Job"("bookingId");

-- DeviceReading: append-only telemetry log
CREATE TABLE "DeviceReading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tdsPpm" INTEGER,
    "usageLitres" INTEGER,
    "filterLifePct" INTEGER,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DeviceReading_deviceId_createdAt_idx" ON "DeviceReading"("deviceId", "createdAt");
CREATE INDEX "DeviceReading_deviceId_kind_createdAt_idx" ON "DeviceReading"("deviceId", "kind", "createdAt");

-- PushToken: per-device push tokens for Expo / FCM / APNs delivery
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "deviceLabel" TEXT,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- WaitlistEntry: notify-me for non-serviceable cities
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "cityName" TEXT NOT NULL,
    "pincode" TEXT,
    "productId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'APP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "WaitlistEntry_cityName_createdAt_idx" ON "WaitlistEntry"("cityName", "createdAt");
CREATE INDEX "WaitlistEntry_phone_idx" ON "WaitlistEntry"("phone");

-- HelpRequest: customer-initiated support touchpoints
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "topic" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "handledBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "HelpRequest_status_createdAt_idx" ON "HelpRequest"("status", "createdAt");
