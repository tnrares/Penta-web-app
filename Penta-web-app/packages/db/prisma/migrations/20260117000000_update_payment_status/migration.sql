-- First, add the new enum values
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Update existing data: transform old values to new ones
UPDATE "invoices" SET "status" = 'UNPAID' WHERE "status" = 'EMITTED_UNPAID';
UPDATE "invoices" SET "status" = 'PARTIAL' WHERE "status" = 'PARTIALLY_PAID';
UPDATE "invoices" SET "status" = 'PAID' WHERE "status" = 'PAID_IN_FULL';
-- OVERDUE stays the same

-- Now we need to remove the old enum values
-- PostgreSQL doesn't support removing enum values directly, so we need to:
-- 1. Create a new enum with only the values we want
-- 2. Alter the column to use the new enum
-- 3. Drop the old enum

-- Create new enum
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED');

-- Alter table to use new enum
ALTER TABLE "invoices" 
  ALTER COLUMN "status" TYPE "PaymentStatus_new" 
  USING "status"::text::"PaymentStatus_new";

-- Drop old enum and rename new one
DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
