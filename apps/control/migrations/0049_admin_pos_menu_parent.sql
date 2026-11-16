ALTER TABLE menus ADD COLUMN pos_parent_id TEXT;

ALTER TABLE menus ADD COLUMN admin_reparented INTEGER NOT NULL DEFAULT 0
CHECK (admin_reparented IN (0,1) AND (admin_reparented=0 OR source='pos'));
