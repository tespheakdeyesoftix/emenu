PRAGMA foreign_keys = ON;

ALTER TABLE businesses ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh';
ALTER TABLE businesses ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'automatic'
  CHECK(pricing_mode IN ('automatic', 'manual'));
ALTER TABLE businesses ADD COLUMN default_price_list_id TEXT;
ALTER TABLE businesses ADD COLUMN menu_cache_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS price_lists (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_normal INTEGER NOT NULL DEFAULT 0,
  schedule_enabled INTEGER NOT NULL DEFAULT 0,
  schedule_start_local TEXT,
  schedule_end_local TEXT,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_business_name
ON price_lists(business_id, name COLLATE NOCASE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_lists_business_normal
ON price_lists(business_id)
WHERE is_normal = 1;

CREATE INDEX IF NOT EXISTS idx_price_lists_business_schedule
ON price_lists(business_id, is_archived, schedule_enabled, schedule_start_local, schedule_end_local);

INSERT INTO price_lists (id, business_id, name, is_normal)
SELECT 'prl_' || lower(hex(randomblob(16))), business.id, 'Normal Rate', 1
FROM businesses business
WHERE NOT EXISTS (
  SELECT 1 FROM price_lists existing
  WHERE existing.business_id = business.id AND existing.is_normal = 1
);

UPDATE businesses
SET default_price_list_id = (
  SELECT list.id FROM price_lists list
  WHERE list.business_id = businesses.id AND list.is_normal = 1
)
WHERE default_price_list_id IS NULL;

CREATE TABLE IF NOT EXISTS product_prices (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  price_list_id TEXT NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  target_key TEXT NOT NULL,
  price_amount REAL NOT NULL CHECK(price_amount >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (price_list_id, product_id, target_key)
);

CREATE INDEX IF NOT EXISTS idx_product_prices_business_product
ON product_prices(business_id, product_id, price_list_id);

INSERT OR IGNORE INTO product_prices
  (business_id, price_list_id, product_id, target_key, price_amount)
SELECT product.business_id, business.default_price_list_id, product.id,
  'base', product.price_cents
FROM products product
JOIN businesses business ON business.id = product.business_id
WHERE business.default_price_list_id IS NOT NULL;

INSERT OR IGNORE INTO product_prices
  (business_id, price_list_id, product_id, target_key, price_amount)
SELECT product.business_id, business.default_price_list_id, product.id,
  json_extract(portion.value, '$.id'),
  CAST(json_extract(portion.value, '$.priceCents') AS REAL)
FROM products product
JOIN businesses business ON business.id = product.business_id
JOIN json_each(product.portions_json) portion
WHERE business.default_price_list_id IS NOT NULL
  AND json_extract(portion.value, '$.id') IS NOT NULL
  AND json_extract(portion.value, '$.priceCents') IS NOT NULL;

PRAGMA optimize;
