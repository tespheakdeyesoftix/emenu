ALTER TABLE categories ADD COLUMN name_km TEXT;
ALTER TABLE categories ADD COLUMN name_en TEXT;
ALTER TABLE categories ADD COLUMN name_zh TEXT;
ALTER TABLE categories ADD COLUMN image_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;

ALTER TABLE products ADD COLUMN name_km TEXT;
ALTER TABLE products ADD COLUMN name_en TEXT;
ALTER TABLE products ADD COLUMN name_zh TEXT;
ALTER TABLE products ADD COLUMN primary_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;

UPDATE categories
SET name_km = name, name_en = name, name_zh = name
WHERE name_km IS NULL;

UPDATE products
SET name_km = name, name_en = name, name_zh = name
WHERE name_km IS NULL;

UPDATE businesses SET locale = 'km' WHERE locale = 'en';

CREATE TABLE IF NOT EXISTS product_images (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_product_images_product
ON product_images(business_id, product_id, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_images_one_primary
ON product_images(product_id)
WHERE is_primary = 1;

PRAGMA optimize;
