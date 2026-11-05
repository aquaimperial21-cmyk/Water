-- In-app notifications now also go out as phone pushes (cron/push-outbox.ts).
-- pushedAt marks the ones already sent.
ALTER TABLE "Notification" ADD COLUMN "pushedAt" TIMESTAMP(3);

-- Everything created before this change counts as handled, so turning push
-- on doesn't send customers their whole notification history.
UPDATE "Notification" SET "pushedAt" = "createdAt";

CREATE INDEX "Notification_pushedAt_createdAt_idx" ON "Notification"("pushedAt", "createdAt");
