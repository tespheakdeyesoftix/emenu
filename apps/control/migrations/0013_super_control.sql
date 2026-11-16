PRAGMA foreign_keys = ON;

ALTER TABLE sessions ADD COLUMN business_id TEXT;
ALTER TABLE sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'customer';
ALTER TABLE sessions ADD COLUMN actor_email TEXT;

CREATE INDEX IF NOT EXISTS idx_sessions_business
ON sessions(business_id, expires_at);

CREATE TABLE IF NOT EXISTS super_admin_audit_log (
  id TEXT PRIMARY KEY,
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  business_id TEXT,
  user_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_created
ON super_admin_audit_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_super_admin_audit_business
ON super_admin_audit_log(business_id, created_at DESC);

PRAGMA optimize;
