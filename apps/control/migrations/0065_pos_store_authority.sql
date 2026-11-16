CREATE TABLE pos_store_authorities (
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  epoch TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  enrolled_at TEXT NOT NULL,
  enrolled_by TEXT NOT NULL,
  PRIMARY KEY (business_id, branch_id),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches(business_id,id) ON DELETE CASCADE
);

CREATE TRIGGER pos_store_authority_branch_active
BEFORE UPDATE OF is_active ON branches
WHEN NEW.is_active=0 AND OLD.is_active=1 AND EXISTS (
  SELECT 1 FROM pos_store_authorities a WHERE a.business_id=OLD.business_id AND a.branch_id=OLD.id
)
BEGIN
  SELECT RAISE(ABORT,'POS_BRANCH_HAS_ACTIVITY');
END;
