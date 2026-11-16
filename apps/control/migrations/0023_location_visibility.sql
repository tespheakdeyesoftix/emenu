UPDATE businesses
SET locations_json = (
  SELECT json_group_array(
    json_object(
      'label', COALESCE(json_extract(value, '$.label'), ''),
      'address', COALESCE(json_extract(value, '$.address'), ''),
      'mapUrl', COALESCE(json_extract(value, '$.mapUrl'), ''),
      'showInMenu', COALESCE(json_extract(value, '$.showInMenu'), 1)
    )
  )
  FROM json_each(businesses.locations_json)
)
WHERE json_valid(locations_json)
  AND json_array_length(locations_json) > 0;

PRAGMA optimize;
