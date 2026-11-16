ALTER TABLE businesses ADD COLUMN business_hours_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN contact_numbers_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN email TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN website_url TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN social_links_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN map_url TEXT NOT NULL DEFAULT '';

UPDATE businesses
SET contact_numbers_json = json_array(json_object('label', 'Main', 'number', phone))
WHERE phone <> '' AND contact_numbers_json = '[]';

PRAGMA optimize;
