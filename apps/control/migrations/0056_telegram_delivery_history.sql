DROP TRIGGER enqueue_custom_telegram_order;
DROP TRIGGER enqueue_custom_telegram_booking;
DROP INDEX idx_telegram_notification_deliveries_due;

ALTER TABLE telegram_notification_deliveries RENAME TO telegram_notification_deliveries_previous;

-- Keep delivery history even when its notification rule is deleted.
CREATE TABLE telegram_notification_deliveries (
  notification_id TEXT NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  chat_id TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  error TEXT,
  PRIMARY KEY (notification_id,source_id,chat_id)
);

INSERT INTO telegram_notification_deliveries
  (notification_id,business_id,source,source_id,source_reference,chat_id,status,attempts,next_attempt_at,created_at,updated_at,error)
SELECT delivery.notification_id,rule.business_id,
  CASE WHEN o.id IS NOT NULL THEN 'Order' WHEN bk.id IS NOT NULL THEN 'Booking' ELSE rule.source END,
  delivery.source_id,COALESCE(o.order_number,delivery.source_id),delivery.chat_id,delivery.status,
  delivery.attempts,delivery.next_attempt_at,COALESCE(unixepoch(o.submitted_at),unixepoch(bk.created_at),delivery.updated_at),
  delivery.updated_at,delivery.error
FROM telegram_notification_deliveries_previous delivery
JOIN telegram_notifications rule ON rule.id=delivery.notification_id
LEFT JOIN orders o ON o.id=delivery.source_id AND o.business_id=rule.business_id
LEFT JOIN bookings bk ON bk.id=delivery.source_id AND bk.business_id=rule.business_id;

DROP TABLE telegram_notification_deliveries_previous;

CREATE INDEX idx_telegram_notification_deliveries_due ON telegram_notification_deliveries(next_attempt_at)
  WHERE status='pending';
CREATE INDEX idx_telegram_notification_deliveries_history ON telegram_notification_deliveries(business_id,created_at DESC);
CREATE INDEX idx_telegram_notification_deliveries_expiry ON telegram_notification_deliveries(created_at);

CREATE TRIGGER enqueue_custom_telegram_order AFTER INSERT ON orders
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,business_id,source,source_id,source_reference,chat_id)
  SELECT rule.id,NEW.business_id,'Order',NEW.id,COALESCE(NEW.order_number,NEW.id),recipient.chat_id
  FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Order' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;

CREATE TRIGGER enqueue_custom_telegram_booking AFTER INSERT ON bookings
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,business_id,source,source_id,source_reference,chat_id)
  SELECT rule.id,NEW.business_id,'Booking',NEW.id,NEW.id,recipient.chat_id
  FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Booking' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;
