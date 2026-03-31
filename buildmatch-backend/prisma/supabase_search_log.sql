-- ── search_log ────────────────────────────────────────────────────────────────
-- Records every text-based contractor search so /api/admin/analytics/search-gaps
-- can surface unmet demand (queries that returned 0 results).
--
-- user_id is TEXT (not UUID) because the Prisma-managed "User" table uses CUIDs.
-- Null for unauthenticated (public) searches.
--
-- Run this in the Supabase SQL editor (service-role or dashboard).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  query        TEXT        NOT NULL,
  filters      JSONB,
  result_count INT         NOT NULL,
  user_id      TEXT        REFERENCES "User"(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for zero-result analytics
CREATE INDEX IF NOT EXISTS search_log_result_count_idx ON search_log (result_count);
-- Fast recency filter (analytics uses NOW() - INTERVAL '30 days')
CREATE INDEX IF NOT EXISTS search_log_created_at_idx   ON search_log (created_at DESC);
-- Audit trail per user
CREATE INDEX IF NOT EXISTS search_log_user_id_idx      ON search_log (user_id)
  WHERE user_id IS NOT NULL;

-- RLS: deny all direct client access — service-role only
ALTER TABLE search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service-role only"
  ON search_log
  USING  (FALSE)
  WITH CHECK (FALSE);
