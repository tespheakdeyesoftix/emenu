ALTER TABLE businesses ADD COLUMN hourly_device_order_limit INTEGER NOT NULL DEFAULT 10
CHECK(typeof(hourly_device_order_limit) = 'integer' AND hourly_device_order_limit BETWEEN 1 AND 999);
