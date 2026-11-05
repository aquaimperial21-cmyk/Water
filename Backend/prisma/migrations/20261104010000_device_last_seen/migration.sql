-- When the purifier last reached the server: any authorised /state poll or
-- heartbeat. Online = seen within 25 hours, since a paid purifier now checks
-- only once a day.
ALTER TABLE "Device" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
