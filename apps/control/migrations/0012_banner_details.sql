ALTER TABLE banners ADD COLUMN detail_text TEXT NOT NULL DEFAULT '';

PRAGMA optimize;
