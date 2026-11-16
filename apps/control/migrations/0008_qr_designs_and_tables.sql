PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS table_groups (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES table_groups(id) ON DELETE RESTRICT,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  public_token TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_designs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preset_key TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'menu' CHECK(target_type IN ('menu','table')),
  config_json TEXT NOT NULL,
  background_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_table_groups_business_name
ON table_groups(business_id, name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_table_groups_business_order
ON table_groups(business_id, is_active, sort_order);

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurant_tables_business_code
ON restaurant_tables(business_id, code COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_business_group
ON restaurant_tables(business_id, group_id, is_active, sort_order);

CREATE INDEX IF NOT EXISTS idx_qr_designs_business_updated
ON qr_designs(business_id, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_designs_business_default
ON qr_designs(business_id)
WHERE is_default = 1;

INSERT INTO table_groups (id, business_id, name, sort_order, is_active)
SELECT 'grp_' || lower(hex(randomblob(16))), business.id, 'Main Area', 0, 1
FROM businesses business
WHERE NOT EXISTS (
  SELECT 1 FROM table_groups existing WHERE existing.business_id = business.id
);

INSERT INTO qr_designs (
  id, business_id, name, preset_key, target_type, config_json, is_default
)
SELECT
  'qrd_' || lower(hex(randomblob(16))),
  business.id,
  'My QR Menu',
  'table-card',
  'menu',
  '{"version":1,"businessNameMode":"profile","taglineMode":"profile","customBusinessName":"","customTagline":"","ctaText":"Scan to view our menu","showLogo":true,"backgroundType":"color","backgroundColor":"#10231d","backgroundImageUrl":"","backgroundPositionX":50,"backgroundPositionY":50,"overlayColor":"#10231d","overlayOpacity":20,"textColor":"#ffffff","accentColor":"#a6ef67","qrDarkColor":"#10231d","qrLightColor":"#ffffff","fontFamily":"Manrope","headingSize":34,"taglineSize":16,"ctaSize":17,"logoScale":20,"qrScale":46,"alignment":"center","customWidthMm":100,"customHeightMm":150}',
  1
FROM businesses business
WHERE NOT EXISTS (
  SELECT 1 FROM qr_designs existing WHERE existing.business_id = business.id
);

PRAGMA optimize;
