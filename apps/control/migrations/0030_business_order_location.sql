ALTER TABLE businesses ADD COLUMN latitude REAL CHECK(latitude BETWEEN -90 AND 90);
ALTER TABLE businesses ADD COLUMN longitude REAL CHECK(longitude BETWEEN -180 AND 180);

ALTER TABLE businesses ADD COLUMN order_radius_meters INTEGER NOT NULL DEFAULT 100
CHECK(typeof(order_radius_meters) = 'integer' AND order_radius_meters > 0);

ALTER TABLE businesses ADD COLUMN enable_submit_order INTEGER NOT NULL DEFAULT 0
CHECK(enable_submit_order IN (0, 1)
  AND (enable_submit_order = 0 OR (latitude IS NOT NULL AND longitude IS NOT NULL)));
