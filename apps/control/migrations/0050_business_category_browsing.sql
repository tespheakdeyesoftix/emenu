-- The default enables category browsing for existing businesses and new registrations.
ALTER TABLE businesses ADD COLUMN allow_category_browsing INTEGER NOT NULL DEFAULT 1
CHECK (allow_category_browsing IN (0,1));
