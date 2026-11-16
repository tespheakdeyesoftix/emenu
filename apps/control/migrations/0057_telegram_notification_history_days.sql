ALTER TABLE telegram_notifications ADD COLUMN history_days INTEGER NOT NULL DEFAULT 7
  CHECK (typeof(history_days)='integer' AND history_days BETWEEN 1 AND 90);
ALTER TABLE telegram_notification_deliveries ADD COLUMN history_days INTEGER NOT NULL DEFAULT 7
  CHECK (typeof(history_days)='integer' AND history_days BETWEEN 1 AND 90);

DROP INDEX idx_telegram_notification_deliveries_expiry;
CREATE INDEX idx_telegram_notification_deliveries_expiry
  ON telegram_notification_deliveries(created_at + history_days * 86400);

DROP TRIGGER enqueue_custom_telegram_order;
CREATE TRIGGER enqueue_custom_telegram_order AFTER INSERT ON orders
BEGIN
  INSERT INTO telegram_notification_deliveries
    (notification_id,business_id,source,source_id,source_reference,chat_id,history_days)
  SELECT rule.id,NEW.business_id,'Order',NEW.id,COALESCE(NEW.order_number,NEW.id),recipient.chat_id,rule.history_days
  FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Order' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;

DROP TRIGGER enqueue_custom_telegram_booking;
CREATE TRIGGER enqueue_custom_telegram_booking AFTER INSERT ON bookings
BEGIN
  INSERT INTO telegram_notification_deliveries
    (notification_id,business_id,source,source_id,source_reference,chat_id,history_days)
  SELECT rule.id,NEW.business_id,'Booking',NEW.id,NEW.id,recipient.chat_id,rule.history_days
  FROM telegram_notifications rule
  JOIN telegram_notification_entitlements entitlement ON entitlement.business_id=rule.business_id
  JOIN telegram_notification_recipients recipient ON recipient.notification_id=rule.id
  WHERE rule.business_id=NEW.business_id AND rule.source='Booking' AND rule.enabled=1
    AND (rule.branch_id IS NULL OR rule.branch_id=NEW.branch_id);
END;

-- Delivery rows keep the saved limit if the rule is later deleted.
CREATE TRIGGER telegram_notification_update_history_days AFTER UPDATE OF history_days ON telegram_notifications
WHEN OLD.history_days<>NEW.history_days
BEGIN
  UPDATE telegram_notification_deliveries SET history_days=NEW.history_days
  WHERE notification_id=NEW.id AND business_id=NEW.business_id;
END;

CREATE TRIGGER telegram_notification_cancel_changed_deliveries
AFTER UPDATE OF branch_id,source,telegram_token,chat_id,title,message,enabled ON telegram_notifications
WHEN OLD.branch_id IS NOT NEW.branch_id OR OLD.source<>NEW.source OR OLD.telegram_token<>NEW.telegram_token
  OR OLD.chat_id<>NEW.chat_id OR OLD.title<>NEW.title OR OLD.message<>NEW.message OR OLD.enabled<>NEW.enabled
BEGIN
  UPDATE telegram_notification_deliveries
  SET status='cancelled',error='Notification settings changed before delivery.',updated_at=unixepoch()
  WHERE notification_id=NEW.id AND business_id=NEW.business_id AND status='pending';
END;
