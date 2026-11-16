CREATE TABLE branches (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  map_url TEXT NOT NULL DEFAULT '',
  latitude REAL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL CHECK (longitude BETWEEN -180 AND 180),
  order_radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (typeof(order_radius_meters)='integer' AND order_radius_meters>0),
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1) AND (is_default=0 OR is_active=1)),
  CHECK ((latitude IS NULL) = (longitude IS NULL)),
  UNIQUE (business_id,slug)
);

CREATE UNIQUE INDEX idx_branches_business_default ON branches(business_id) WHERE is_default=1;

INSERT INTO branches (id,business_id,slug,name,address,phone,map_url,latitude,longitude,order_radius_meters,is_default)
SELECT 'br_' || lower(hex(randomblob(16))),b.id,'main',b.name,b.address,b.phone,b.map_url,
  CASE WHEN b.longitude IS NOT NULL THEN b.latitude END,
  CASE WHEN b.latitude IS NOT NULL THEN b.longitude END,b.order_radius_meters,1
FROM businesses b WHERE NOT EXISTS (SELECT 1 FROM branches WHERE business_id=b.id);

-- Keep the previous Worker compatible during gradual deployment and rollback.
CREATE TRIGGER business_default_branch AFTER INSERT ON businesses
BEGIN
  INSERT INTO branches (id,business_id,slug,name,address,phone,map_url,latitude,longitude,order_radius_meters,is_default)
  VALUES ('br_' || lower(hex(randomblob(16))),NEW.id,'main',NEW.name,NEW.address,NEW.phone,NEW.map_url,
    CASE WHEN NEW.longitude IS NOT NULL THEN NEW.latitude END,
    CASE WHEN NEW.latitude IS NOT NULL THEN NEW.longitude END,NEW.order_radius_meters,1);
END;

CREATE TABLE menus (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  parent_id TEXT,
  slug TEXT NOT NULL,
  name_km TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  name_zh TEXT NOT NULL DEFAULT '',
  image_media_id TEXT REFERENCES media(id) ON DELETE SET NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local','pos')),
  UNIQUE (business_id,id),
  UNIQUE (business_id,slug),
  FOREIGN KEY (business_id,parent_id) REFERENCES menus(business_id,id) DEFERRABLE INITIALLY DEFERRED,
  CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE INDEX idx_menus_business_parent ON menus(business_id,parent_id,sort_order);
CREATE TRIGGER menus_owner_immutable BEFORE UPDATE OF business_id,source ON menus
WHEN OLD.business_id<>NEW.business_id OR OLD.source<>NEW.source
BEGIN
  SELECT RAISE(ABORT,'CATALOG_TENANT_CONFLICT');
END;
CREATE UNIQUE INDEX idx_products_business_id ON products(business_id,id);

CREATE TABLE menu_products (
  business_id TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (business_id,menu_id,product_id),
  FOREIGN KEY (business_id,menu_id) REFERENCES menus(business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (business_id,product_id) REFERENCES products(business_id,id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_products_product ON menu_products(business_id,product_id);

ALTER TABLE table_groups ADD COLUMN branch_id TEXT REFERENCES branches(id);
ALTER TABLE restaurant_tables ADD COLUMN branch_id TEXT REFERENCES branches(id);
ALTER TABLE orders ADD COLUMN branch_id TEXT REFERENCES branches(id);
ALTER TABLE orders ADD COLUMN menu_id TEXT REFERENCES menus(id);
ALTER TABLE analytics_events ADD COLUMN branch_id TEXT REFERENCES branches(id);
ALTER TABLE pos_integrations ADD COLUMN last_menu_snapshot_at TEXT;
ALTER TABLE pos_integrations ADD COLUMN last_menu_write_at TEXT;
ALTER TABLE products ADD COLUMN pos_menu_updated_at TEXT;

UPDATE table_groups SET branch_id=(SELECT id FROM branches WHERE business_id=table_groups.business_id AND is_default=1);
UPDATE restaurant_tables SET branch_id=(SELECT branch_id FROM table_groups WHERE id=restaurant_tables.group_id AND business_id=restaurant_tables.business_id);
UPDATE orders SET branch_id=COALESCE(
  (SELECT branch_id FROM restaurant_tables WHERE id=orders.table_id AND business_id=orders.business_id),
  (SELECT id FROM branches WHERE business_id=orders.business_id AND is_default=1));
UPDATE analytics_events SET branch_id=COALESCE(
  (SELECT branch_id FROM restaurant_tables WHERE id=analytics_events.table_id AND business_id=analytics_events.business_id),
  (SELECT id FROM branches WHERE business_id=analytics_events.business_id AND is_default=1));

DROP INDEX idx_table_groups_business_name;
DROP INDEX idx_restaurant_tables_business_code;
CREATE UNIQUE INDEX idx_table_groups_branch_name ON table_groups(business_id,branch_id,name COLLATE NOCASE);
CREATE UNIQUE INDEX idx_restaurant_tables_branch_code ON restaurant_tables(business_id,branch_id,code COLLATE NOCASE);
CREATE INDEX idx_orders_branch_date ON orders(business_id,branch_id,posting_date);
CREATE INDEX idx_analytics_branch_date ON analytics_events(business_id,branch_id,local_date,created_at);

CREATE TRIGGER table_group_default_branch AFTER INSERT ON table_groups WHEN NEW.branch_id IS NULL
BEGIN
  UPDATE table_groups SET branch_id=(SELECT id FROM branches WHERE business_id=NEW.business_id AND is_default=1) WHERE id=NEW.id;
END;

CREATE TRIGGER table_inherited_branch AFTER INSERT ON restaurant_tables WHEN NEW.branch_id IS NULL
BEGIN
  UPDATE restaurant_tables SET branch_id=(SELECT branch_id FROM table_groups WHERE id=NEW.group_id AND business_id=NEW.business_id) WHERE id=NEW.id;
END;

CREATE TRIGGER order_inherited_branch AFTER INSERT ON orders WHEN NEW.branch_id IS NULL
BEGIN
  UPDATE orders SET branch_id=(SELECT branch_id FROM restaurant_tables WHERE id=NEW.table_id AND business_id=NEW.business_id) WHERE id=NEW.id;
END;

CREATE TRIGGER analytics_inherited_branch AFTER INSERT ON analytics_events WHEN NEW.branch_id IS NULL
BEGIN
  UPDATE analytics_events SET branch_id=COALESCE(
    (SELECT branch_id FROM restaurant_tables WHERE id=NEW.table_id AND business_id=NEW.business_id),
    (SELECT id FROM branches WHERE business_id=NEW.business_id AND is_default=1)) WHERE id=NEW.id;
END;

CREATE TRIGGER table_group_branch_insert_guard BEFORE INSERT ON table_groups
WHEN NEW.branch_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM branches WHERE id=NEW.branch_id AND business_id=NEW.business_id)
BEGIN
  SELECT RAISE(ABORT,'TABLE_BRANCH_CONFLICT');
END;

CREATE TRIGGER table_group_branch_update_guard BEFORE UPDATE OF branch_id ON table_groups
WHEN OLD.branch_id IS NOT NULL AND NEW.branch_id IS NOT OLD.branch_id
BEGIN
  SELECT RAISE(ABORT,'TABLE_BRANCH_CONFLICT');
END;

CREATE TRIGGER table_branch_insert_guard BEFORE INSERT ON restaurant_tables
WHEN NOT EXISTS (SELECT 1 FROM table_groups WHERE id=NEW.group_id AND business_id=NEW.business_id
  AND (NEW.branch_id IS NULL OR NEW.branch_id=branch_id))
BEGIN
  SELECT RAISE(ABORT,'TABLE_BRANCH_CONFLICT');
END;

CREATE TRIGGER table_branch_update_guard BEFORE UPDATE OF branch_id,group_id ON restaurant_tables
WHEN (OLD.branch_id IS NOT NULL AND NEW.branch_id IS NOT OLD.branch_id)
  OR NOT EXISTS (SELECT 1 FROM table_groups WHERE id=NEW.group_id AND business_id=NEW.business_id AND branch_id=NEW.branch_id)
BEGIN
  SELECT RAISE(ABORT,'TABLE_BRANCH_CONFLICT');
END;
