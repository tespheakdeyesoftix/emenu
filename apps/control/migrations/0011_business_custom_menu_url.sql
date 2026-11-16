ALTER TABLE businesses ADD COLUMN custom_menu_url TEXT NOT NULL DEFAULT '';

PRAGMA optimize;
