-- ── review_edit_log ──────────────────────────────────────────────────────────
-- Stores the original body of a review each time an admin edits it.
-- review_id and admin_id reference Prisma-managed tables that use CUIDs (TEXT),
-- not UUIDs — hence TEXT FK columns rather than UUID.
--
-- Run this in the Supabase SQL editor (service-role or dashboard).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS review_edit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    TEXT        NOT NULL REFERENCES "Review"(id)  ON DELETE CASCADE,
  admin_id     TEXT        NOT NULL REFERENCES "User"(id)    ON DELETE SET NULL,
  original     TEXT        NOT NULL,
  edited       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by review
CREATE INDEX IF NOT EXISTS review_edit_log_review_id_idx ON review_edit_log (review_id);
-- Index for audit queries by admin
CREATE INDEX IF NOT EXISTS review_edit_log_admin_id_idx  ON review_edit_log (admin_id);

-- RLS: deny all direct client access — service-role only
ALTER TABLE review_edit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service-role only"
  ON review_edit_log
  USING (FALSE)
  WITH CHECK (FALSE);
