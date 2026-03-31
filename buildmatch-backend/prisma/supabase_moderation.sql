-- ============================================================
-- BuildMatch — Moderation schema additions
-- Run in Supabase SQL editor (postgres / service role).
--
-- Adds:
--   • user_warnings table (admin-only, service-role access)
--   • flagged_for_review column on "User"
--   • is_flagged + is_deleted columns on "Review"
--
-- NOTE: If the audit_log.action column uses the admin_action
-- ENUM type, extend it first:
--
--   ALTER TYPE admin_action ADD VALUE IF NOT EXISTS 'USER_WARN';
--   ALTER TYPE admin_action ADD VALUE IF NOT EXISTS 'USER_ESCALATE';
--   ALTER TYPE admin_action ADD VALUE IF NOT EXISTS 'CONTENT_APPROVE';
--   ALTER TYPE admin_action ADD VALUE IF NOT EXISTS 'CONTENT_REMOVE';
--
-- Prerequisite: "User" and "Review" tables must exist (Prisma).
-- ============================================================

-- ── 1. user_warnings ─────────────────────────────────────────
-- Admin-issued warnings against a user.
-- user_id / admin_id are TEXT (CUIDs) to match Prisma PKs.

CREATE TABLE IF NOT EXISTS user_warnings (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES "User"(id),
  admin_id   TEXT        NOT NULL REFERENCES "User"(id),
  type       TEXT        NOT NULL,  -- 'MESSAGE_FILTER_WARNING' | 'ESCALATION'
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. user_warnings RLS ────────────────────────────────────
-- Admin-only via service role. Deny all direct access.

ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin only warnings" ON user_warnings;
CREATE POLICY "Admin only warnings"
  ON user_warnings
  FOR ALL
  USING (false);

-- ── 3. user_warnings indexes ────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_warnings_user
  ON user_warnings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_warnings_admin
  ON user_warnings (admin_id);

-- ── 4. flagged_for_review column on "User" ──────────────────
-- Set true when an admin escalates a user for immediate review.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_flagged_for_review
  ON "User" (flagged_for_review)
  WHERE flagged_for_review = true;

-- ── 5. is_flagged + is_deleted on "Review" ──────────────────
-- is_flagged: review has been flagged and is in the content queue.
-- is_deleted: soft-delete; filtered out from all user-facing queries.

ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_review_flagged
  ON "Review" (is_flagged)
  WHERE is_flagged = true AND is_deleted = false;
