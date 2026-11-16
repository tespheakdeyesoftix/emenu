CREATE TABLE telegram_notifications (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id TEXT,
  source TEXT NOT NULL CHECK (length(source) BETWEEN 1 AND 40),
  telegram_token TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id,branch_id) REFERENCES branches(business_id,id) ON DELETE CASCADE
);

-- telegram_token stores the existing business-scoped AES-GCM ciphertext.
CREATE UNIQUE INDEX idx_telegram_notifications_destination ON telegram_notifications
  (business_id,source,COALESCE(branch_id,''),chat_id COLLATE NOCASE);
CREATE INDEX idx_telegram_notifications_branch ON telegram_notifications(business_id,branch_id);

CREATE TABLE telegram_notification_deliveries (
  notification_id TEXT NOT NULL REFERENCES telegram_notifications(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  error TEXT,
  PRIMARY KEY (notification_id,source_id)
);

CREATE INDEX idx_telegram_notification_deliveries_due ON telegram_notification_deliveries(next_attempt_at)
  WHERE status='pending';

CREATE VIEW telegram_notification_entitlements AS
SELECT b.id AS business_id FROM businesses b
JOIN business_subscriptions subscription ON subscription.business_id=b.id
JOIN subscription_plans plan ON plan.id=subscription.plan_id
WHERE b.is_active=1 AND subscription.status IN ('active','trialing')
  AND (subscription.current_period_end_at IS NULL OR julianday(subscription.current_period_end_at)>julianday('now'))
  AND EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(plan.features_json) THEN plan.features_json ELSE '[]' END)
    WHERE value='telegramNotifications')
  AND NOT EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(b.disabled_control_pages_json) THEN b.disabled_control_pages_json ELSE '[]' END)
    WHERE value='telegramNotifications');

CREATE TRIGGER enqueue_custom_telegram_order AFTER INSERT ON orders
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,source_id)
  SELECT route.id,NEW.id FROM telegram_notifications route
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
  WHERE route.business_id=NEW.business_id AND route.source='Order' AND route.enabled=1
    AND (route.branch_id IS NULL OR route.branch_id=NEW.branch_id);
END;

CREATE TRIGGER enqueue_custom_telegram_booking AFTER INSERT ON bookings
BEGIN
  INSERT INTO telegram_notification_deliveries (notification_id,source_id)
  SELECT route.id,NEW.id FROM telegram_notifications route
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
  WHERE route.business_id=NEW.business_id AND route.source='Booking' AND route.enabled=1
    AND (route.branch_id IS NULL OR route.branch_id=NEW.branch_id);
END;

-- An applicable custom rule takes precedence for that source and branch, even
-- when paused. Otherwise the existing Super Control setting still applies.
DROP TRIGGER enqueue_telegram_order;
CREATE TRIGGER enqueue_telegram_order AFTER INSERT ON orders
WHEN NOT EXISTS (
  SELECT 1 FROM telegram_notifications route
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
  WHERE route.business_id=NEW.business_id AND route.source='Order'
    AND (route.branch_id IS NULL OR route.branch_id=NEW.branch_id)
)
BEGIN
  INSERT INTO telegram_order_deliveries (order_id,business_id)
  SELECT NEW.id,NEW.business_id FROM business_telegram_notifications
  WHERE business_id=NEW.business_id AND enabled=1;
END;

DROP TRIGGER enqueue_telegram_booking;
CREATE TRIGGER enqueue_telegram_booking AFTER INSERT ON bookings
WHEN NOT EXISTS (
  SELECT 1 FROM telegram_notifications route
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=route.business_id
  WHERE route.business_id=NEW.business_id AND route.source='Booking'
    AND (route.branch_id IS NULL OR route.branch_id=NEW.branch_id)
)
BEGIN
  INSERT INTO telegram_booking_deliveries (booking_id,chat_id)
  SELECT NEW.id,branch.chat_id FROM branch_booking_settings branch
  JOIN business_booking_settings settings ON settings.business_id=branch.business_id
  WHERE branch.business_id=NEW.business_id AND branch.branch_id=NEW.branch_id
    AND settings.telegram_enabled=1 AND settings.encrypted_token IS NOT NULL AND branch.chat_id<>'';
END;
