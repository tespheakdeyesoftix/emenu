ALTER TABLE subscription_plans ADD COLUMN max_branches INTEGER
CHECK (max_branches IS NULL OR (typeof(max_branches)='integer' AND max_branches>=1));
ALTER TABLE subscription_plans ADD COLUMN max_menus INTEGER
CHECK (max_menus IS NULL OR (typeof(max_menus)='integer' AND max_menus>=0));
ALTER TABLE subscription_plans ADD COLUMN max_products INTEGER
CHECK (max_products IS NULL OR (typeof(max_products)='integer' AND max_products>=0));
ALTER TABLE subscription_plans ADD COLUMN max_daily_orders INTEGER
CHECK (max_daily_orders IS NULL OR (typeof(max_daily_orders)='integer' AND max_daily_orders BETWEEN 0 AND 999));

-- Only inserts consume capacity. An upsert of an existing record can still edit it.
CREATE TRIGGER subscription_branch_limit AFTER INSERT ON branches
WHEN EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_branches IS NOT NULL
    AND (SELECT COUNT(*) FROM branches WHERE business_id=NEW.business_id)>p.max_branches
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_BRANCH_LIMIT');
END;

CREATE TRIGGER subscription_menu_limit AFTER INSERT ON menus
WHEN EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_menus IS NOT NULL
    AND (SELECT COUNT(*) FROM menus WHERE business_id=NEW.business_id)>p.max_menus
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_MENU_LIMIT');
END;

CREATE TRIGGER subscription_product_limit AFTER INSERT ON products
WHEN EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_products IS NOT NULL
    AND (SELECT COUNT(*) FROM products WHERE business_id=NEW.business_id)>p.max_products
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_PRODUCT_LIMIT');
END;

CREATE TRIGGER subscription_daily_order_limit AFTER INSERT ON orders
WHEN EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_daily_orders IS NOT NULL
    AND (SELECT COUNT(*) FROM orders WHERE business_id=NEW.business_id AND posting_date=NEW.posting_date)>p.max_daily_orders
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_DAILY_ORDER_LIMIT');
END;
