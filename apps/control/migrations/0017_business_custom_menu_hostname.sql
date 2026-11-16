ALTER TABLE businesses ADD COLUMN custom_menu_hostname TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_custom_menu_hostname
ON businesses(custom_menu_hostname COLLATE NOCASE)
WHERE custom_menu_hostname <> '';

PRAGMA optimize;
