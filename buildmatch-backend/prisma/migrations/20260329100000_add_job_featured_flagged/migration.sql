-- Add isFeatured, isFlagged, flaggedReason columns to Job table
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isFeatured"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isFlagged"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "flaggedReason" TEXT;
