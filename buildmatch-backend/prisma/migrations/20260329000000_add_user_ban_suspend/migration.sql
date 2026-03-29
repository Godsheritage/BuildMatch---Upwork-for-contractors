-- Migration: add is_banned and suspended_until to the User table
-- Run via: npm run db:migrate (or apply manually)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBanned"       BOOLEAN      NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspendedUntil" TIMESTAMP(3);
