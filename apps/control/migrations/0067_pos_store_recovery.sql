ALTER TABLE pos_store_authorities ADD COLUMN public_key TEXT;

UPDATE pos_store_authorities AS a SET public_key=(
  SELECT CASE WHEN count(DISTINCT d.public_key)=1 THEN min(d.public_key) END
  FROM pos_device_credentials d
  JOIN pos_profiles p ON p.business_id=d.business_id AND p.id=d.profile_id
  WHERE d.business_id=a.business_id AND p.branch_id=a.branch_id
    AND d.device_id=a.device_id AND d.user_id=a.enrolled_by
);

CREATE TABLE pos_store_operator_history (
  business_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  PRIMARY KEY (business_id,profile_id,device_id,public_key,operator_id),
  FOREIGN KEY (business_id,profile_id) REFERENCES pos_profiles(business_id,id) ON DELETE CASCADE
);

INSERT INTO pos_store_operator_history
  (business_id,profile_id,device_id,public_key,operator_id)
SELECT business_id,profile_id,device_id,public_key,user_id FROM pos_device_credentials;

CREATE TRIGGER pos_store_remember_operator
AFTER INSERT ON pos_device_credentials
BEGIN
  INSERT OR IGNORE INTO pos_store_operator_history
    (business_id,profile_id,device_id,public_key,operator_id)
  VALUES (NEW.business_id,NEW.profile_id,NEW.device_id,NEW.public_key,NEW.user_id);
END;

CREATE TABLE pos_store_recoveries (
  epoch TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  PRIMARY KEY (epoch,sequence),
  FOREIGN KEY (business_id,profile_id,command_id)
    REFERENCES pos_commands(business_id,profile_id,idempotency_key) ON DELETE CASCADE
);

CREATE INDEX idx_pos_store_recoveries_branch
  ON pos_store_recoveries (business_id,branch_id,approved_at DESC,epoch,sequence);
