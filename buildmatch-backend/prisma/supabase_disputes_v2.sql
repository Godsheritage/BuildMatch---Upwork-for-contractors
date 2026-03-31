-- ============================================================
-- BuildMatch — Disputes v2 schema
-- Run in Supabase SQL editor (postgres / service role).
--
-- Differences from supabase_disputes_tables.sql (v1):
--   • Native dispute_status / dispute_ruling ENUMs (not TEXT)
--   • UUID primary keys (not TEXT CUIDs)
--   • Simpler disputes table: milestone_draw NOT NULL, reason
--     replaces category + description + desired_outcome
--   • against_id removed; party lookup via jobs.investor_id
--   • ruling_by + ruling_at columns added
--   • dispute_notes table (admin-only) replaces
--     dispute_messages + dispute_evidence
--   • User-facing SELECT policy on disputes (not deny-all);
--     dispute_notes remains deny-all (admin via service role)
--   • updated_at column + trigger
--
-- Prerequisite: the update_updated_at() trigger function must
-- exist. If it doesn't, run the block below once first:
--
--   CREATE OR REPLACE FUNCTION update_updated_at()
--   RETURNS TRIGGER LANGUAGE plpgsql AS $$
--   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
--   $$;
-- ============================================================

-- ── 1. ENUMs ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE dispute_status AS ENUM (
    'OPEN',
    'UNDER_REVIEW',
    'RESOLVED',
    'CLOSED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE dispute_ruling AS ENUM (
    'INVESTOR',
    'CONTRACTOR',
    'SPLIT',
    'WITHDRAWN'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. disputes ───────────────────────────────────────────────
-- One row per filed dispute.
-- filed_by_id  — the user (investor or contractor) who opened it
-- milestone_draw — which milestone number is under dispute (1-based)
-- amount_disputed — dollar amount at stake
-- reason       — free-text explanation of the dispute
-- ruling_by    — admin user who recorded the ruling
-- ruling_at    — timestamp of the ruling decision

-- NOTE: job_id / filed_by_id / ruling_by are TEXT (not UUID) because the
-- Prisma "Job" and "User" tables use CUID text primary keys, not UUIDs.

CREATE TABLE IF NOT EXISTS disputes (
  id              UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          TEXT           NOT NULL REFERENCES "Job"(id),
  filed_by_id     TEXT           NOT NULL REFERENCES "User"(id),
  milestone_draw  INT            NOT NULL,
  amount_disputed NUMERIC        NOT NULL,
  reason          TEXT           NOT NULL,
  status          dispute_status NOT NULL DEFAULT 'OPEN',
  ruling          dispute_ruling,
  ruling_note     TEXT,
  ruling_by       TEXT           REFERENCES "User"(id),
  ruling_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── 3. dispute_notes ──────────────────────────────────────────
-- Internal admin-only notes attached to a dispute.
-- Never exposed to end users; accessed via service role only.

CREATE TABLE IF NOT EXISTS dispute_notes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id  UUID        NOT NULL REFERENCES disputes(id) ON DELETE CASCADE,
  admin_id    TEXT        NOT NULL REFERENCES "User"(id),
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 4. Row-level security ─────────────────────────────────────

ALTER TABLE disputes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_notes ENABLE ROW LEVEL SECURITY;

-- disputes: party-only read access
--   • The user who filed the dispute, OR
--   • The investor who owns the job (the other party)
-- Write access (INSERT / UPDATE / DELETE) is denied to all
-- authenticated roles; mutations go through the service role key.

DROP POLICY IF EXISTS "Users see own disputes" ON disputes;
CREATE POLICY "Users see own disputes"
  ON disputes
  FOR SELECT
  USING (
    filed_by_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM "Job" j
      WHERE j.id = job_id
        AND j."investorId" = auth.uid()::text
    )
  );

-- dispute_notes: deny all direct access — admin reads/writes
-- exclusively via the service role key (bypasses RLS).

DROP POLICY IF EXISTS "Admin only notes" ON dispute_notes;
CREATE POLICY "Admin only notes"
  ON dispute_notes
  FOR ALL
  USING (false);

-- ── 5. updated_at trigger ─────────────────────────────────────

DROP TRIGGER IF EXISTS set_disputes_updated_at ON disputes;
CREATE TRIGGER set_disputes_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── 6. Indexes ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_disputes_v2_filed_by
  ON disputes (filed_by_id);

CREATE INDEX IF NOT EXISTS idx_disputes_v2_job
  ON disputes (job_id);

CREATE INDEX IF NOT EXISTS idx_disputes_v2_status
  ON disputes (status);

CREATE INDEX IF NOT EXISTS idx_disputes_v2_created
  ON disputes (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dispute_notes_dispute
  ON dispute_notes (dispute_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dispute_notes_admin
  ON dispute_notes (admin_id);
