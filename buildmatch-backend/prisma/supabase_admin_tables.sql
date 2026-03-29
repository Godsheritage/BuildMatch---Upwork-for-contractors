-- ============================================================
-- Admin infrastructure tables
-- Run in Supabase SQL editor (service role or postgres role).
-- ============================================================

-- IMPORTANT: admin_id is typed as UUID to match auth.users(id).
-- If your Prisma users table uses TEXT/CUID ids, change
-- admin_id / banned_by / updated_by to TEXT accordingly.
-- ============================================================

-- ── admin_action enum ────────────────────────────────────────

CREATE TYPE admin_action AS ENUM (
  'USER_SUSPEND','USER_UNSUSPEND','USER_BAN','USER_UNBAN',
  'USER_ROLE_CHANGE','USER_VERIFY','USER_IMPERSONATE',
  'JOB_REMOVE','JOB_FEATURE','JOB_STATUS_CHANGE',
  'DISPUTE_RULING','DISPUTE_NOTE','DISPUTE_CLOSE',
  'REVIEW_APPROVE','REVIEW_REMOVE','REVIEW_EDIT',
  'MESSAGE_VIEW','MESSAGE_REMOVE',
  'PAYMENT_RETRY','PAYMENT_REFUND',
  'SETTING_CHANGE','FEATURE_FLAG_CHANGE',
  'FILTER_PATTERN_ADD','FILTER_PATTERN_REMOVE'
);

-- ── audit_log ────────────────────────────────────────────────

CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES users(id),
  action      admin_action NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  payload     JSONB,
  ip_address  TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_admin_id   ON audit_log(admin_id);
CREATE INDEX idx_audit_log_action     ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ── platform_settings ────────────────────────────────────────

CREATE TABLE platform_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO platform_settings (key, value, description) VALUES
  ('transaction_fee_pct',      '3.5',   'Platform fee percentage'),
  ('max_bids_free_tier',       '5',     'Max bids/month free plan'),
  ('maintenance_mode',         'false', 'Enable maintenance mode'),
  ('allow_new_registrations',  'true',  'Pause signups when false');

-- ── feature_flags ─────────────────────────────────────────────

CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN DEFAULT false,
  rollout_pct INT DEFAULT 100,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO feature_flags (key, enabled, rollout_pct, description) VALUES
  ('ai_reply_polisher', false, 0,   'AI reply polish for messages'),
  ('ai_auto_classify',  false, 0,   'Auto-classify job trade type'),
  ('ai_auto_resolve',   false, 0,   'AI auto-resolve incoming jobs'),
  ('homeowner_portal',  false, 0,   'Phase 2 homeowner section');

-- ── banned_emails ─────────────────────────────────────────────

CREATE TABLE banned_emails (
  email      TEXT PRIMARY KEY,
  banned_at  TIMESTAMPTZ DEFAULT NOW(),
  banned_by  UUID REFERENCES users(id),
  reason     TEXT
);

CREATE INDEX idx_banned_emails_banned_at ON banned_emails(banned_at DESC);

-- ── Row Level Security (deny all public access) ───────────────

ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_emails    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access" ON audit_log        FOR ALL USING (false);
CREATE POLICY "No public access" ON platform_settings FOR ALL USING (false);
CREATE POLICY "No public access" ON feature_flags    FOR ALL USING (false);
CREATE POLICY "No public access" ON banned_emails    FOR ALL USING (false);
