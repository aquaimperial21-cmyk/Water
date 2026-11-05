-- Cancelling a plan with nothing to pay back (a zero deposit after lock-in,
-- every TEST plan) used to queue a Rs 0 REFUND in INITIATED. Only the Razorpay
-- refund.processed webhook settles a refund, and Razorpay can't refund zero,
-- so those rows stayed "in progress" for ever: the app showed a Rs 0 refund in
-- progress, the newest refund hid a real one still on its way, and account
-- deletion was refused (ACCOUNT_REFUND_PENDING). Cancel no longer queues them.
--
-- Settle the ones already there as the webhook settles a refund: SUCCESS, and
-- "updatedAt" (set by Prisma on every update) to now, in UTC like every Prisma
-- timestamp whatever the server's time zone. "gatewayRef" stays: the webhook
-- puts the Razorpay refund id there, and no refund went through Razorpay.
UPDATE "Payment"
SET "status" = 'SUCCESS', "updatedAt" = CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
WHERE "kind" = 'REFUND' AND "status" = 'INITIATED' AND "amountPaise" = 0;
