CREATE TABLE branch_webhooks (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  name TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches(business_id, id) ON DELETE CASCADE
);

CREATE INDEX branch_webhooks_scope ON branch_webhooks(business_id, branch_id, archived, enabled);

CREATE TABLE branch_webhook_revisions (
  webhook_id TEXT NOT NULL REFERENCES branch_webhooks(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  name TEXT NOT NULL,
  table_key TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('inserted', 'updated', 'deleted')),
  url TEXT NOT NULL,
  host TEXT NOT NULL,
  method TEXT NOT NULL,
  filter_json TEXT NOT NULL CHECK (json_valid(filter_json)),
  body_json TEXT NOT NULL CHECK (json_valid(body_json)),
  include_contact INTEGER NOT NULL CHECK (include_contact IN (0, 1)),
  header_names_json TEXT NOT NULL CHECK (json_valid(header_names_json)),
  headers_ciphertext TEXT NOT NULL,
  PRIMARY KEY (webhook_id, revision)
);

CREATE TABLE branch_webhook_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE DEFAULT (lower(hex(randomblob(16)))),
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  table_key TEXT NOT NULL,
  record_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('inserted', 'updated', 'deleted')),
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  previous_json TEXT CHECK (json_valid(previous_json)),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (business_id, branch_id) REFERENCES branches(business_id, id) ON DELETE CASCADE
);

CREATE INDEX branch_webhook_events_stream
  ON branch_webhook_events(business_id, branch_id, table_key, record_id, sequence);
CREATE INDEX branch_webhook_events_retention ON branch_webhook_events(created_at);

CREATE TABLE branch_webhook_deliveries (
  id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  event_sequence INTEGER NOT NULL REFERENCES branch_webhook_events(sequence) ON DELETE CASCADE,
  webhook_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  host TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'succeeded', 'failed', 'stopped', 'expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  due_at INTEGER NOT NULL DEFAULT (unixepoch()),
  attempted_at INTEGER,
  lease_token TEXT,
  http_status INTEGER,
  error TEXT,
  UNIQUE (event_sequence, webhook_id),
  FOREIGN KEY (webhook_id, revision) REFERENCES branch_webhook_revisions(webhook_id, revision) ON DELETE CASCADE
);

CREATE INDEX branch_webhook_deliveries_due ON branch_webhook_deliveries(status, due_at);
CREATE INDEX branch_webhook_deliveries_stream ON branch_webhook_deliveries(event_sequence, host, status);
CREATE INDEX branch_webhook_deliveries_rule ON branch_webhook_deliveries(webhook_id, revision);

-- Only explicit application events enter the outbox. Fan-out uses the rule
-- revision and filters that existed in the same transaction as the write.
CREATE TRIGGER branch_webhook_fanout AFTER INSERT ON branch_webhook_events
BEGIN
  INSERT INTO branch_webhook_deliveries (event_sequence, webhook_id, revision, host)
  SELECT NEW.sequence, rule.id, rule.revision, config.host
  FROM branch_webhooks rule
  JOIN branch_webhook_revisions config ON config.webhook_id=rule.id AND config.revision=rule.revision
  WHERE rule.business_id=NEW.business_id AND rule.branch_id=NEW.branch_id
    AND rule.enabled=1 AND rule.archived=0 AND config.table_key=NEW.table_key AND config.event=NEW.event
    AND NOT EXISTS (
      SELECT 1 FROM json_each(config.filter_json) AS condition
      WHERE NOT (CASE json_extract(condition.value, '$.op')
        WHEN 'eq' THEN json_extract(NEW.record_json, '$.' || json_extract(condition.value, '$.field'))
          IS json_extract(condition.value, '$.value')
        WHEN 'neq' THEN json_extract(NEW.record_json, '$.' || json_extract(condition.value, '$.field'))
          IS NOT json_extract(condition.value, '$.value')
        WHEN 'in' THEN EXISTS (
          SELECT 1 FROM json_each(condition.value, '$.value') AS option
          WHERE option.value IS json_extract(NEW.record_json, '$.' || json_extract(condition.value, '$.field'))
        )
        WHEN 'changed' THEN json_extract(NEW.record_json, '$.' || json_extract(condition.value, '$.field'))
          IS NOT json_extract(NEW.previous_json, '$.' || json_extract(condition.value, '$.field'))
        ELSE 0
      END)
    );
  DELETE FROM branch_webhook_events WHERE sequence=NEW.sequence
    AND NOT EXISTS (SELECT 1 FROM branch_webhook_deliveries WHERE event_sequence=NEW.sequence);
END;
