ALTER TABLE businesses
ADD COLUMN enable_add_to_order INTEGER NOT NULL DEFAULT 1
CHECK(enable_add_to_order IN (0, 1));
