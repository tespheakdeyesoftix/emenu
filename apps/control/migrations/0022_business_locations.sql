ALTER TABLE businesses ADD COLUMN locations_json TEXT NOT NULL DEFAULT '[]';

UPDATE businesses
SET locations_json = json_array(
  json_object(
    'label', COALESCE(NULLIF(TRIM(map_label), ''), 'Main branch'),
    'address', address,
    'mapUrl', map_url,
    'showInMenu', 1
  )
)
WHERE locations_json = '[]'
  AND (TRIM(map_url) <> '' OR TRIM(address) <> '');

PRAGMA optimize;
