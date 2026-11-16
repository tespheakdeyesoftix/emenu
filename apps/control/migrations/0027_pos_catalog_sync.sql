PRAGMA foreign_keys = ON;

CREATE TABLE pos_integrations (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'POS',
  token_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  catalog_version INTEGER NOT NULL DEFAULT 0,
  last_source_updated_at TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pos_sync_requests (
  business_id TEXT NOT NULL REFERENCES pos_integrations(business_id) ON DELETE CASCADE,
  sync_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  source_updated_at TEXT NOT NULL,
  base_version INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_id, sync_id)
);

-- The guard and all catalog writes execute in the same D1 batch transaction.
-- Concurrent imports or key rotation must not commit against an old snapshot.
CREATE TRIGGER pos_sync_requests_version_guard
BEFORE INSERT ON pos_sync_requests
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id AND catalog_version = NEW.base_version
  ) THEN RAISE(ABORT, 'POS_SYNC_CONFLICT') END;
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id
      AND last_source_updated_at >= NEW.source_updated_at
  ) THEN RAISE(ABORT, 'POS_SYNC_STALE') END;
END;

-- POS UUIDs are global primary keys. Never let an upsert transfer another
-- business's existing record to the business associated with the API key.
CREATE TRIGGER categories_business_immutable
BEFORE UPDATE OF business_id ON categories
WHEN OLD.business_id <> NEW.business_id
BEGIN
  SELECT RAISE(ABORT, 'CATALOG_TENANT_CONFLICT');
END;

CREATE TRIGGER products_business_immutable
BEFORE UPDATE OF business_id ON products
WHEN OLD.business_id <> NEW.business_id
BEGIN
  SELECT RAISE(ABORT, 'CATALOG_TENANT_CONFLICT');
END;

PRAGMA optimize;
