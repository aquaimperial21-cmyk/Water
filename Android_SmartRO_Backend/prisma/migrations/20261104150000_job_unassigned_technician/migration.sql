-- A paid customer can book an install slot even when no technician is free:
-- the INSTALL job is saved without one and an admin assigns a technician later.
-- Only the NOT NULL goes; the foreign key and index stay as they were.
ALTER TABLE "Job" ALTER COLUMN "technicianId" DROP NOT NULL;
