ALTER TABLE menus ADD COLUMN deleted_in_admin INTEGER NOT NULL DEFAULT 0
CHECK (deleted_in_admin IN (0,1) AND (deleted_in_admin=0 OR (source='pos' AND is_active=0)));

DROP TRIGGER subscription_menu_limit;
CREATE TRIGGER subscription_menu_limit AFTER INSERT ON menus
WHEN NEW.deleted_in_admin=0 AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_menus IS NOT NULL
    AND (SELECT COUNT(*) FROM menus WHERE business_id=NEW.business_id AND deleted_in_admin=0)>p.max_menus
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_MENU_LIMIT');
END;
