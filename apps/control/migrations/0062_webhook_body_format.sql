ALTER TABLE branch_webhook_revisions ADD COLUMN body_format TEXT NOT NULL DEFAULT 'json'
  CHECK (body_format IN ('json', 'text', 'none'));
