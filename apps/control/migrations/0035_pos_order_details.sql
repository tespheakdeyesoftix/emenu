ALTER TABLE order_products ADD COLUMN portion_id TEXT;
ALTER TABLE order_products ADD COLUMN product_code TEXT;
ALTER TABLE order_products ADD COLUMN product_name TEXT;

CREATE INDEX idx_orders_business_status_date ON orders(business_id, status, posting_date);
