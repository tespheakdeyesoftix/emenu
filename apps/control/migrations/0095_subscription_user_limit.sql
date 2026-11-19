-- Existing plans remain unlimited. The owner counts toward the per-business limit.
ALTER TABLE subscription_plans ADD COLUMN max_users INTEGER
CHECK (max_users IS NULL OR (typeof(max_users)='integer' AND max_users>=1));

-- Enforce the quota inside the successful write, including concurrent requests.
CREATE TRIGGER subscription_user_limit AFTER INSERT ON memberships
WHEN EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_users IS NOT NULL
    AND (SELECT COUNT(*) FROM memberships WHERE business_id=NEW.business_id)>p.max_users
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_USER_LIMIT');
END;

CREATE TRIGGER subscription_user_limit_move AFTER UPDATE OF business_id ON memberships
WHEN NEW.business_id<>OLD.business_id AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_users IS NOT NULL
    AND (SELECT COUNT(*) FROM memberships WHERE business_id=NEW.business_id)>p.max_users
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_USER_LIMIT');
END;
