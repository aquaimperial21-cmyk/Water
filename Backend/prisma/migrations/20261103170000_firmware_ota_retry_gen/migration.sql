-- Remote updates: a per-purifier counter the admin Retry button bumps. It is
-- sent with every firmware offer so the chip also resets its own try count.

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "otaRetryGen" INTEGER NOT NULL DEFAULT 0;
