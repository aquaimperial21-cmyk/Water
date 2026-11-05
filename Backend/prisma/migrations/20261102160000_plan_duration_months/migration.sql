-- Plans are sold in calendar months, not day counts. Monthly runs to the
-- same date next month (31 Jan -> 28/29 Feb), lock-in lasts one term, and
-- Razorpay autopay debits on that calendar date.
ALTER TABLE "Plan" ADD COLUMN "durationMonths" INTEGER;

-- 30 -> 1, 90 -> 3, 180 -> 6, 365 -> 12.
UPDATE "Plan" SET "durationMonths" = GREATEST(1, ROUND("durationDays" / 30.0));

ALTER TABLE "Plan" ALTER COLUMN "durationMonths" SET NOT NULL;
ALTER TABLE "Plan" DROP COLUMN "durationDays";
