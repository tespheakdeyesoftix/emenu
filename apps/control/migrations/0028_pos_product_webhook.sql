ALTER TABLE products ADD COLUMN pos_source_updated_at TEXT;

-- A null product_id identifies a catalog request, including existing receipts.
ALTER TABLE pos_sync_requests ADD COLUMN product_id TEXT;

DROP TRIGGER pos_sync_requests_version_guard;

CREATE TRIGGER pos_sync_requests_version_guard
BEFORE INSERT ON pos_sync_requests
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id AND catalog_version = NEW.base_version
  ) THEN RAISE(ABORT, 'POS_SYNC_CONFLICT') END;
  SELECT CASE WHEN NEW.product_id IS NULL AND EXISTS (
    SELECT 1 FROM pos_integrations
    WHERE business_id = NEW.business_id
      AND last_source_updated_at >= NEW.source_updated_at
  ) THEN RAISE(ABORT, 'POS_SYNC_STALE') END;
END;
