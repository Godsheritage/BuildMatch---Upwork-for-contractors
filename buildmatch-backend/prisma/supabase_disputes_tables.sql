-- ============================================================
-- BuildMatch — Dispute system tables
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. disputes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id               TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_id           TEXT        NOT NULL,
  filed_by_id      TEXT        NOT NULL,
  against_id       TEXT        NOT NULL,
  milestone_draw   INTEGER,
  amount_disputed  NUMERIC     NOT NULL,
  category         TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  desired_outcome  TEXT        NOT NULL,
  status           TEXT        NOT NULL DEFAULT 'OPEN',
  ruling           TEXT,
  ruling_note      TEXT,
  resolved_at      TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
-- Service-role key bypasses RLS; deny all anon/authenticated direct access
CREATE POLICY "deny_all_disputes" ON disputes AS RESTRICTIVE
  USING (false);

-- 2. dispute_messages ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_messages (
  id         TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dispute_id TEXT        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  sender_id  TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  is_system  BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dispute_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_dispute_messages" ON dispute_messages AS RESTRICTIVE
  USING (false);

-- Enable Realtime for live dispute thread updates
ALTER PUBLICATION supabase_realtime ADD TABLE dispute_messages;

-- 3. dispute_evidence ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dispute_evidence (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  dispute_id   TEXT        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  submitted_by TEXT        NOT NULL,
  type         TEXT        NOT NULL,
  url          TEXT,
  description  TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_dispute_evidence" ON dispute_evidence AS RESTRICTIVE
  USING (false);

-- 4. audit_log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  action     TEXT        NOT NULL,
  actor_id   TEXT        NOT NULL,
  entity_id  TEXT        NOT NULL,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deny_all_audit_log" ON audit_log AS RESTRICTIVE
  USING (false);

-- ── Indexes for common query patterns ────────────────────────
CREATE INDEX IF NOT EXISTS idx_disputes_filed_by    ON disputes (filed_by_id);
CREATE INDEX IF NOT EXISTS idx_disputes_against     ON disputes (against_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status      ON disputes (status);
CREATE INDEX IF NOT EXISTS idx_disputes_activity    ON disputes (last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_dispute_msgs_dispute ON dispute_messages (dispute_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dispute_evid_dispute ON dispute_evidence (dispute_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity     ON audit_log (entity_id, created_at DESC);
