-- POS is opt-in for existing plans as well as newly created plans.
UPDATE subscription_plans SET pos_enabled=0 WHERE pos_enabled=1;

-- Preserve existing sidebar preferences and append only missing POS page keys.
UPDATE businesses
SET disabled_control_pages_json=json_insert(disabled_control_pages_json,'$[#]','sellingOverview')
WHERE NOT EXISTS (SELECT 1 FROM json_each(disabled_control_pages_json) WHERE value='sellingOverview');

UPDATE businesses
SET disabled_control_pages_json=json_insert(disabled_control_pages_json,'$[#]','posProfiles')
WHERE NOT EXISTS (SELECT 1 FROM json_each(disabled_control_pages_json) WHERE value='posProfiles');

UPDATE businesses
SET disabled_control_pages_json=json_insert(disabled_control_pages_json,'$[#]','posPaymentTypes')
WHERE NOT EXISTS (SELECT 1 FROM json_each(disabled_control_pages_json) WHERE value='posPaymentTypes');
