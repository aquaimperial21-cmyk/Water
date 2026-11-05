-- Remote firmware updates (OTA): signed ESP32 images the admin uploads and
-- rolls out, and each purifier's progress with the release it was offered.

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "otaAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "otaError" TEXT,
ADD COLUMN     "otaReleaseId" TEXT,
ADD COLUMN     "otaStatus" TEXT,
ADD COLUMN     "otaUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FirmwareRelease" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "notes" TEXT,
    "filePath" TEXT NOT NULL,
    "rollout" TEXT NOT NULL DEFAULT 'OFF',
    "testSerials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "installNow" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmwareRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FirmwareRelease_version_key" ON "FirmwareRelease"("version");

-- CreateIndex
CREATE INDEX "FirmwareRelease_rollout_createdAt_idx" ON "FirmwareRelease"("rollout", "createdAt");

-- CreateIndex
CREATE INDEX "Device_otaReleaseId_idx" ON "Device"("otaReleaseId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_otaReleaseId_fkey" FOREIGN KEY ("otaReleaseId") REFERENCES "FirmwareRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

