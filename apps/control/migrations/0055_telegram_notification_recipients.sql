DROP TRIGGER enqueue_custom_telegram_order;
DROP TRIGGER enqueue_custom_telegram_booking;
DROP INDEX idx_telegram_notification_deliveries_due;

ALTER TABLE telegram_notification_deliveries RENAME TO telegram_notification_deliveries_single_chat;

CREATE TABLE telegram_notification_deliveries (
  notification_id TEXT NOT NULL REFERENCES telegram_notifications(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  chat_id TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  error TEXT,
  PRIMARY KEY (notification_id,source_id,chat_id)
);

INSERT INTO telegram_notification_deliveries
  (notification_id,source_id,chat_id,status,attempts,next_attempt_at,updated_at,error)
SELECT delivery.notification_id,delivery.source_id,rule.chat_id,delivery.status,
  delivery.attempts,delivery.next_attempt_at,delivery.updated_at,delivery.error
FROM telegram_notification_deliveries_single_chat delivery
JOIN telegram_notifications rule ON rule.id=delivery.notification_id;

DROP TABLE telegram_notification_deliveries_single_chat;

CREATE INDEX idx_telegram_notification_deliveries_due ON telegram_notification_deliveries(next_attempt_at)
  WHERE status='pending';

DROP INDEX idx_telegram_notifications_destination;
CREATE INDEX idx_telegram_notifications_scope ON telegram_notifications(business_id,source,branch_id);

-- The admin API stores validated chat IDs joined by commas with no spaces.
-- A single ID has the same representation as before the migration.
CREATE VIEW telegram_notification_recipients AS
SELECT rule.id AS notification_id,rule.business_id,rule.source,rule.branch_id,recipient.value AS chat_id
FROM telegram_notifications rule
JOIN json_each(replace(json_array(rule.chat_id), ',', '","')) recipient;

CREATE TRIGGER telegram_notification_unique_recipients_insert BEFORE INSERT ON telegram_notifications
WHEN EXISTS (
  SELECT 1 FROM telegram_notification_recipients existing
  JOIN json_each(replace(json_array(NEW.chat_id), ',', '","')) incoming ON existing.chat_id=incoming.value COLLATE NOCASE
  WHERE existing.business_id=NEW.business_id AND existing.source=NEW.source AND existing.branch_id IS NEW.branch_id
)
BEGIN
  SELECT RAISE(ABORT, 'TELEGRAM_DUPLICATE_RECIPIENT');
END;

CREATE TRIGGER telegram_notification_unique_recipients_update
BEFORE UPDATE OF business_id,source,branch_id,chat_id ON telegram_notifications
WHEN EXISTS (
  SELECT 1 FROM telegram_notification_recipients existing
  JOIN json_each(replace(json_array(NEW.chat_id), ',', '","')) incoming ON existing.chat_id=incoming.value COLLATE NOCASE
  WHERE existing.business_id=NEW.business_id AND existing.source=NEW.source AND existing.branch_id IS NEW.branch_id
    AND existing.notification_id<>NEW.id
)
BEGIN
  SELECT RAISE(ABORT, 'TELEGRAM_DUPLICATE_RECIPIENT');
END;

CREATE TRIGGER enqueue_custom_telegram_order AFTER INSERT ON orders
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,source_id,chat_id)
  SELECT rule.id,NEW.id,recipient.chat_id FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Order' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;

CREATE TRIGGER enqueue_custom_telegram_booking AFTER INSERT ON bookings
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,source_id,chat_id)
  SELECT rule.id,NEW.id,recipient.chat_id FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Booking' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;
