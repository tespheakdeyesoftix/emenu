ALTER TABLE products ADD COLUMN rating REAL
CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5));

PRAGMA optimize;
