ALTER TABLE branches ADD COLUMN enable_submit_order INTEGER
CHECK (enable_submit_order IN (0, 1));

ALTER TABLE branches ADD COLUMN use_business_order_radius INTEGER NOT NULL DEFAULT 1
CHECK (use_business_order_radius IN (0, 1));

ALTER TABLE branches ADD COLUMN has_order_location_override INTEGER NOT NULL DEFAULT 0
CHECK (has_order_location_override IN (0, 1)
  AND (has_order_location_override=0 OR (latitude IS NOT NULL AND longitude IS NOT NULL)));

-- Preserve custom branch values and leave copied default-branch coordinates intact.
UPDATE branches
SET use_business_order_radius=0, has_order_location_override=(latitude IS NOT NULL)
WHERE is_default=0;
