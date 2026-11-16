ALTER TABLE businesses RENAME COLUMN hourly_device_order_limit TO previous_hourly_device_order_limit;

ALTER TABLE businesses ADD COLUMN hourly_device_order_limit INTEGER NOT NULL DEFAULT 10
CHECK(typeof(hourly_device_order_limit) = 'integer' AND hourly_device_order_limit BETWEEN 0 AND 999);

UPDATE businesses SET hourly_device_order_limit = previous_hourly_device_order_limit
WHERE previous_hourly_device_order_limit <> 10;

ALTER TABLE businesses DROP COLUMN previous_hourly_device_order_limit;
