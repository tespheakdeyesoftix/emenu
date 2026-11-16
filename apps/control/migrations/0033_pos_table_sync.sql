ALTER TABLE pos_sync_requests ADD COLUMN is_table_sync INTEGER NOT NULL DEFAULT 0
  CHECK (is_table_sync IN (0, 1));

DROP TRIGGER pos_sync_requests_version_guard;

CREATE TRIGGER pos_sync_requests_version_guard
BEFORE INSERT ON pos_sync_requests
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id AND catalog_version = NEW.base_version
  ) THEN RAISE(ABORT, 'POS_SYNC_CONFLICT') END;
  SELECT CASE WHEN NEW.product_id IS NULL AND NEW.is_table_sync = 0 AND EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id
      AND last_source_updated_at >= NEW.source_updated_at
  ) THEN RAISE(ABORT, 'POS_SYNC_STALE') END;
END;

CREATE TRIGGER table_groups_business_immutable
BEFORE UPDATE OF business_id ON table_groups
WHEN OLD.business_id <> NEW.business_id
BEGIN
  SELECT RAISE(ABORT, 'CATALOG_TENANT_CONFLICT');
END;

CREATE TRIGGER restaurant_tables_business_immutable
BEFORE UPDATE OF business_id ON restaurant_tables
WHEN OLD.business_id <> NEW.business_id
BEGIN
  SELECT RAISE(ABORT, 'CATALOG_TENANT_CONFLICT');
END;
