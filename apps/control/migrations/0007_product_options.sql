ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN portions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN modifier_groups_json TEXT NOT NULL DEFAULT '[]';

PRAGMA optimize;
