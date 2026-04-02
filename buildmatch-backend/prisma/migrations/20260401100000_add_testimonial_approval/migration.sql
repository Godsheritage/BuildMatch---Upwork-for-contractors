-- AlterTable: add approval columns to testimonials
ALTER TABLE "testimonials" ADD COLUMN "approved"   BOOLEAN   NOT NULL DEFAULT false;
ALTER TABLE "testimonials" ADD COLUMN "approvedAt" TIMESTAMP(3);
