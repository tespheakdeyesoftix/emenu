PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  features_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_plan_prices (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0),
  billing_interval TEXT NOT NULL CHECK(billing_interval IN ('month','year')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK(interval_count > 0),
  provider TEXT,
  provider_price_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS business_subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  price_id TEXT REFERENCES subscription_plan_prices(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','provider')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('trialing','active','past_due','canceled')),
  trial_ends_at TEXT,
  current_period_start_at TEXT,
  current_period_end_at TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscription_plan_prices_plan
ON subscription_plan_prices(plan_id, is_active, currency);

CREATE INDEX IF NOT EXISTS idx_business_subscriptions_period_end
ON business_subscriptions(current_period_end_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_prices_provider
ON subscription_plan_prices(provider, provider_price_id)
WHERE provider IS NOT NULL AND provider_price_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_subscriptions_provider
ON business_subscriptions(provider, provider_subscription_id)
WHERE provider IS NOT NULL AND provider_subscription_id IS NOT NULL;

INSERT OR IGNORE INTO subscription_plans
  (id, code, name, description, features_json, is_active, display_order)
VALUES
  ('plan_standard', 'standard', 'Standard',
   'Complete digital menu management for restaurants and hospitality businesses.',
   '["Digital menu management","QR menu designs","Unlimited menu items","Price lists and scheduling"]',
   1, 10);

INSERT OR IGNORE INTO subscription_plan_prices
  (id, plan_id, code, currency, amount_minor, billing_interval, interval_count, is_active)
VALUES
  ('price_standard_usd_monthly', 'plan_standard', 'standard-usd-monthly',
   'USD', 2499, 'month', 1, 1);

INSERT OR IGNORE INTO business_subscriptions
  (id, business_id, plan_id, price_id, source, status,
   current_period_start_at, current_period_end_at)
SELECT
  'sub_' || lower(hex(randomblob(16))), business.id, 'plan_standard',
  'price_standard_usd_monthly', 'manual', 'active', business.created_at, NULL
FROM businesses business;

PRAGMA optimize;
