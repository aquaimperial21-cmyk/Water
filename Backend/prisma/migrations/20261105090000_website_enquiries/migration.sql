-- The marketing website's enquiry forms (contact page + pop-up) now post to
-- POST /inquiries/website instead of a third-party mail service, so every
-- enquiry lands in the admin console's Inquiries page.
--
-- The website doesn't ask for a pincode, so it becomes optional. The new
-- columns keep what the visitor typed (email, city, product, how they heard
-- about us) even when it doesn't match a City or Product row. "source" tells
-- app enquiries (every existing row: 'APP') from WEBSITE_CONTACT / WEBSITE_POPUP.
ALTER TABLE "Inquiry" ALTER COLUMN "pincode" DROP NOT NULL;
ALTER TABLE "Inquiry" ADD COLUMN "email" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'APP';
ALTER TABLE "Inquiry" ADD COLUMN "cityName" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "productName" TEXT;
ALTER TABLE "Inquiry" ADD COLUMN "heardFrom" TEXT;

CREATE INDEX "Inquiry_source_createdAt_idx" ON "Inquiry"("source", "createdAt");
