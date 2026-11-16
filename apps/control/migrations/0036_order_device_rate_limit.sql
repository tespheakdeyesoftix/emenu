ALTER TABLE orders ADD COLUMN device_id TEXT;

CREATE INDEX idx_orders_business_device_submitted_at
ON orders(business_id, device_id, submitted_at)
WHERE device_id IS NOT NULL;
