ALTER TABLE businesses ADD COLUMN show_business_hours INTEGER NOT NULL DEFAULT 1
CHECK(show_business_hours IN (0, 1));

PRAGMA optimize;
