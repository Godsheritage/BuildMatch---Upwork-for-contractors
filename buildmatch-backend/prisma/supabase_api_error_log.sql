-- ── api_error_log ──────────────────────────────────────────────────────────────
-- Stores every 5xx error emitted by the global Express error handler.
-- Read by GET /api/admin/health/errors.
--
-- user_id is TEXT (not UUID) because Prisma-managed "User" table uses CUIDs.
-- Null for unauthenticated requests.
--
-- Run this in the Supabase SQL editor (service-role or dashboard).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_error_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint     TEXT        NOT NULL,
  method       TEXT        NOT NULL,
  status_code  INT         NOT NULL,
  error_msg    TEXT,
  user_id      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup for the /errors endpoint (recent errors by time)
CREATE INDEX IF NOT EXISTS api_error_log_created_at_idx
  ON api_error_log (created_at DESC);

-- Filter by endpoint
CREATE INDEX IF NOT EXISTS api_error_log_endpoint_idx
  ON api_error_log (endpoint);

-- Filter by status code
CREATE INDEX IF NOT EXISTS api_error_log_status_code_idx
  ON api_error_log (status_code);

-- RLS: deny all direct client access — service-role writes only
ALTER TABLE api_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service-role only"
  ON api_error_log
  USING  (FALSE)
  WITH CHECK (FALSE);

-- ── background_job_log ────────────────────────────────────────────────────────
-- Records every background job execution so GET /api/admin/health/background-jobs
-- can surface failures and staleness.
--
-- status: 'success' | 'failed' | 'running'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS background_job_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name     TEXT        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('success', 'failed', 'running')),
  error_msg    TEXT,
  duration_ms  INT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Latest run per job name (dashboard only shows last 24h)
CREATE INDEX IF NOT EXISTS background_job_log_created_at_idx
  ON background_job_log (created_at DESC);

CREATE INDEX IF NOT EXISTS background_job_log_job_name_idx
  ON background_job_log (job_name, created_at DESC);

-- RLS: deny all direct client access — service-role only
ALTER TABLE background_job_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service-role only"
  ON background_job_log
  USING  (FALSE)
  WITH CHECK (FALSE);
