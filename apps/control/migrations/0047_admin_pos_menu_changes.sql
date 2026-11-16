ALTER TABLE menus ADD COLUMN admin_active INTEGER
CHECK (admin_active IS NULL OR (source='pos' AND admin_active IN (0,1)));

ALTER TABLE menu_products ADD COLUMN assigned_in_admin INTEGER NOT NULL DEFAULT 0
CHECK (assigned_in_admin IN (0,1));
