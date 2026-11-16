ALTER TABLE subscription_plans ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0
CHECK (is_public IN (0, 1));

-- Existing plans previously allowed every Control page.
UPDATE subscription_plans
SET features_json='["overview","business","appearance","catalog","menus","priceLists","managePrices","orders","reports","tables","banners","qrDesigns"]',
    is_public=CASE WHEN id='plan_standard' THEN 1 ELSE 0 END;

ALTER TABLE businesses ADD COLUMN subscription_plan_id TEXT REFERENCES subscription_plans(id);

INSERT INTO business_subscriptions
  (id,business_id,plan_id,price_id,source,status,current_period_start_at)
SELECT 'sub_' || lower(hex(randomblob(16))),business.id,'plan_standard',
  'price_standard_usd_monthly','manual','active',business.created_at
FROM businesses business
WHERE NOT EXISTS (SELECT 1 FROM business_subscriptions WHERE business_id=business.id);

UPDATE businesses
SET subscription_plan_id=(SELECT plan_id FROM business_subscriptions WHERE business_id=businesses.id);

CREATE TRIGGER subscription_plan_on_insert AFTER INSERT ON business_subscriptions
BEGIN
  UPDATE businesses SET subscription_plan_id=NEW.plan_id WHERE id=NEW.business_id;
END;

CREATE TRIGGER subscription_plan_on_update AFTER UPDATE OF plan_id,business_id ON business_subscriptions
BEGIN
  UPDATE businesses SET subscription_plan_id=NULL WHERE id=OLD.business_id AND OLD.business_id<>NEW.business_id;
  UPDATE businesses SET subscription_plan_id=NEW.plan_id WHERE id=NEW.business_id;
END;

CREATE TRIGGER subscription_plan_on_delete AFTER DELETE ON business_subscriptions
BEGIN
  UPDATE businesses SET subscription_plan_id=NULL WHERE id=OLD.business_id;
END;
