ALTER TABLE pos_sync_requests ADD COLUMN skipped_tables_json TEXT
  CHECK (skipped_tables_json IS NULL OR (json_valid(skipped_tables_json) AND json_type(skipped_tables_json) = 'array'));
