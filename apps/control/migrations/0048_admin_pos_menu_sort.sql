ALTER TABLE menus ADD COLUMN admin_sorted INTEGER NOT NULL DEFAULT 0
CHECK (admin_sorted IN (0,1) AND (admin_sorted=0 OR source='pos'));
