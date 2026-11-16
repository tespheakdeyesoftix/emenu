CREATE TABLE business_telegram_notifications (
  business_id TEXT PRIMARY KEY NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  chat_id TEXT NOT NULL,
  encrypted_token TEXT NOT NULL
);

CREATE TABLE telegram_order_deliveries (
  order_id TEXT PRIMARY KEY NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  error TEXT
);

CREATE INDEX idx_telegram_deliveries_due ON telegram_order_deliveries(next_attempt_at) WHERE status='pending';
CREATE INDEX idx_telegram_deliveries_business ON telegram_order_deliveries(business_id, updated_at DESC);

CREATE TRIGGER enqueue_telegram_order AFTER INSERT ON orders
WHEN EXISTS (SELECT 1 FROM business_telegram_notifications WHERE business_id=NEW.business_id AND enabled=1)
BEGIN
  INSERT INTO telegram_order_deliveries (order_id, business_id) VALUES (NEW.id, NEW.business_id);
END;
