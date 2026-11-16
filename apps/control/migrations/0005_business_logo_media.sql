ALTER TABLE businesses
ADD COLUMN logo_media_id TEXT REFERENCES media(id) ON DELETE SET NULL;

PRAGMA optimize;
