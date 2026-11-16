CREATE TABLE pos_device_credentials (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  public_key TEXT NOT NULL,
  credential_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  revoked_at INTEGER,
  UNIQUE (business_id, profile_id, user_id, device_id),
  FOREIGN KEY (business_id, profile_id) REFERENCES pos_profiles(business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, business_id) REFERENCES memberships(user_id,business_id) ON DELETE CASCADE
);

CREATE TABLE pos_device_proofs (
  credential_id TEXT NOT NULL REFERENCES pos_device_credentials(id) ON DELETE CASCADE,
  nonce TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (credential_id, nonce)
);
CREATE INDEX idx_pos_device_proofs_expiry ON pos_device_proofs(expires_at);

ALTER TABLE pos_sessions ADD COLUMN device_credential_id TEXT REFERENCES pos_device_credentials(id) ON DELETE CASCADE;
ALTER TABLE pos_sessions ADD COLUMN issued_by_device INTEGER NOT NULL DEFAULT 0 CHECK (issued_by_device IN (0,1));
CREATE INDEX idx_pos_sessions_device ON pos_sessions(device_credential_id) WHERE device_credential_id IS NOT NULL;

CREATE TRIGGER pos_device_access_revoked
AFTER UPDATE OF revoked_at ON pos_device_credentials
WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL
BEGIN
  DELETE FROM pos_sessions WHERE device_credential_id=NEW.id;
END;

CREATE TRIGGER pos_device_profile_grant_removed
AFTER DELETE ON pos_profile_grants
WHEN NOT EXISTS (
  SELECT 1 FROM memberships
  WHERE user_id=OLD.user_id AND business_id=OLD.business_id AND role IN ('owner','manager')
)
BEGIN
  UPDATE pos_device_credentials SET revoked_at=unixepoch()
  WHERE business_id=OLD.business_id AND profile_id=OLD.profile_id AND user_id=OLD.user_id
    AND revoked_at IS NULL;
END;
