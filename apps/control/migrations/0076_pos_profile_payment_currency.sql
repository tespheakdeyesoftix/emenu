-- Keep a fixed or previously selected currency. For entries accepting both,
-- prefer the business currency so a migrated profile can still take payment.
WITH configs AS (
  SELECT p.id, b.currency AS business_currency, p.config_json AS config, 0 AS pending
  FROM pos_profiles p JOIN businesses b ON b.id=p.business_id
  UNION ALL
  SELECT p.id, b.currency, p.pending_config_json, 1
  FROM pos_profiles p JOIN businesses b ON b.id=p.business_id
  WHERE p.pending_config_json IS NOT NULL
), migrated AS MATERIALIZED (
  SELECT id,pending,json_set(config,'$.payment_types',json((
    SELECT json_group_array(json_remove(json_set(entry.value,'$.currency',COALESCE(
      json_extract(entry.value,'$.currency'),
      CASE WHEN EXISTS (
        SELECT 1 FROM json_each(entry.value,'$.currencies') AS accepted
        WHERE accepted.value=configs.business_currency
      ) THEN configs.business_currency ELSE json_extract(entry.value,'$.currencies[0]') END
    )),'$.currencies') ORDER BY CAST(entry.key AS INTEGER))
    FROM json_each(config,'$.payment_types') AS entry
  ))) AS config
  FROM configs
  WHERE EXISTS (
    SELECT 1 FROM json_each(config,'$.payment_types') AS entry
    WHERE json_type(entry.value,'$.currencies')='array'
  )
)
UPDATE pos_profiles
SET config_json=COALESCE((SELECT config FROM migrated WHERE id=pos_profiles.id AND pending=0),config_json),
    pending_config_json=COALESCE((SELECT config FROM migrated WHERE id=pos_profiles.id AND pending=1),pending_config_json),
    version=version+EXISTS(SELECT 1 FROM migrated WHERE id=pos_profiles.id AND pending=0)
WHERE id IN (SELECT id FROM migrated);
