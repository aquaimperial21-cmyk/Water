-- Keep the order id and the payment id apart: settlement used to overwrite
-- "gatewayRef" with "order:payment", after which /payments/verify could no
-- longer find the row it had just settled.
ALTER TABLE "Payment" ADD COLUMN "gatewayPaymentId" TEXT;

-- A recharge can move the customer to a different plan; the settle path needs
-- to know which one it was paid for.
ALTER TABLE "Payment" ADD COLUMN "targetPlanId" TEXT;

CREATE INDEX "Payment_gatewayPaymentId_idx" ON "Payment"("gatewayPaymentId");

-- Invoice numbers came from two in-process counters, both seeded from
-- Date.now() % 100000 in modules loaded milliseconds apart, so they handed out
-- the same numbers and the unique index rolled back a settled payment.
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" START 1;
