ALTER TABLE products ADD COLUMN code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_code
ON products(business_id, code COLLATE NOCASE)
WHERE code IS NOT NULL;

PRAGMA optimize;
