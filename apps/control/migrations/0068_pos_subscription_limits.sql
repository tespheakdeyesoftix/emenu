ALTER TABLE subscription_plans ADD COLUMN pos_enabled INTEGER NOT NULL DEFAULT 0
CHECK (pos_enabled IN (0,1));
ALTER TABLE subscription_plans ADD COLUMN max_pos_profiles INTEGER
CHECK (max_pos_profiles IS NULL OR (typeof(max_pos_profiles)='integer' AND max_pos_profiles>=0));
ALTER TABLE subscription_plans ADD COLUMN max_daily_pos_sales INTEGER
CHECK (max_daily_pos_sales IS NULL OR (typeof(max_daily_pos_sales)='integer' AND max_daily_pos_sales>=0));

-- Existing plans already allowed POS. New plans opt in.
UPDATE subscription_plans SET pos_enabled=1;

CREATE INDEX idx_pos_active_profiles ON pos_profiles(business_id) WHERE is_active=1;
CREATE INDEX idx_pos_paid_sales_by_day ON sales(business_id,business_date)
WHERE status='paid' AND reverses_sale_id IS NULL;

CREATE TRIGGER subscription_pos_profile_insert BEFORE INSERT ON pos_profiles
WHEN NEW.is_active=1 AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.pos_enabled=1 AND p.max_pos_profiles IS NOT NULL
    AND (SELECT COUNT(*) FROM pos_profiles WHERE business_id=NEW.business_id AND is_active=1)>=p.max_pos_profiles
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_POS_PROFILE_LIMIT');
END;

CREATE TRIGGER subscription_pos_profile_activate BEFORE UPDATE OF is_active ON pos_profiles
WHEN OLD.is_active=0 AND NEW.is_active=1 AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.pos_enabled=1 AND p.max_pos_profiles IS NOT NULL
    AND (SELECT COUNT(*) FROM pos_profiles WHERE business_id=NEW.business_id AND is_active=1)>=p.max_pos_profiles
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_POS_PROFILE_LIMIT');
END;

-- Keep existing profiles available when a business moves to a smaller POS plan.
CREATE TRIGGER subscription_pos_profile_plan_update
BEFORE UPDATE OF pos_enabled,max_pos_profiles ON subscription_plans
WHEN NEW.pos_enabled=1 AND NEW.max_pos_profiles IS NOT NULL AND EXISTS (
  SELECT 1 FROM business_subscriptions s
  WHERE s.plan_id=NEW.id
    AND (SELECT COUNT(*) FROM pos_profiles WHERE business_id=s.business_id AND is_active=1)>NEW.max_pos_profiles
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_POS_PROFILE_IN_USE');
END;

CREATE TRIGGER subscription_pos_profile_assignment_insert AFTER INSERT ON business_subscriptions
WHEN EXISTS (
  SELECT 1 FROM subscription_plans p WHERE p.id=NEW.plan_id AND p.pos_enabled=1 AND p.max_pos_profiles IS NOT NULL
    AND (SELECT COUNT(*) FROM pos_profiles WHERE business_id=NEW.business_id AND is_active=1)>p.max_pos_profiles
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_POS_PROFILE_IN_USE');
END;

CREATE TRIGGER subscription_pos_profile_assignment_update
AFTER UPDATE OF plan_id,business_id ON business_subscriptions
WHEN EXISTS (
  SELECT 1 FROM subscription_plans p WHERE p.id=NEW.plan_id AND p.pos_enabled=1 AND p.max_pos_profiles IS NOT NULL
    AND (SELECT COUNT(*) FROM pos_profiles WHERE business_id=NEW.business_id AND is_active=1)>p.max_pos_profiles
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_POS_PROFILE_IN_USE');
END;

-- A store import creates a paid sale directly. Cloud checkout settles an open bill.
CREATE TRIGGER subscription_pos_daily_sale_import BEFORE INSERT ON sales
WHEN NEW.status='paid' AND NEW.reverses_sale_id IS NULL AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_daily_pos_sales IS NOT NULL
    AND (SELECT COUNT(*) FROM sales
         WHERE business_id=NEW.business_id AND business_date=NEW.business_date
           AND status='paid' AND reverses_sale_id IS NULL)>=p.max_daily_pos_sales
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_DAILY_POS_SALE_LIMIT');
END;

CREATE TRIGGER subscription_pos_daily_sale_checkout BEFORE UPDATE OF status ON sales
WHEN OLD.status<>'paid' AND NEW.status='paid' AND NEW.reverses_sale_id IS NULL AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_daily_pos_sales IS NOT NULL
    AND (SELECT COUNT(*) FROM sales
         WHERE business_id=NEW.business_id AND business_date=NEW.business_date
           AND status='paid' AND reverses_sale_id IS NULL)>=p.max_daily_pos_sales
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_DAILY_POS_SALE_LIMIT');
END;
