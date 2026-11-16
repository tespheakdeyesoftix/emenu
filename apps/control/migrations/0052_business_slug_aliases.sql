CREATE TABLE business_slug_aliases (
  slug TEXT NOT NULL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE
);

CREATE INDEX idx_business_slug_aliases_business ON business_slug_aliases(business_id);

CREATE TRIGGER businesses_reserve_previous_slug_on_insert
BEFORE INSERT ON businesses
WHEN EXISTS (SELECT 1 FROM business_slug_aliases WHERE slug=NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'BUSINESS_SLUG_IN_USE');
END;

CREATE TRIGGER businesses_reserve_previous_slug_on_update
BEFORE UPDATE OF slug ON businesses
WHEN EXISTS (
  SELECT 1 FROM business_slug_aliases WHERE slug=NEW.slug AND business_id<>OLD.id
)
BEGIN
  SELECT RAISE(ABORT, 'BUSINESS_SLUG_IN_USE');
END;

CREATE TRIGGER businesses_keep_previous_slug
AFTER UPDATE OF slug ON businesses
WHEN OLD.slug<>NEW.slug
BEGIN
  DELETE FROM business_slug_aliases WHERE slug=NEW.slug AND business_id=NEW.id;
  INSERT INTO business_slug_aliases (slug,business_id) VALUES (OLD.slug,NEW.id);
END;
