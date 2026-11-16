ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted'
  CHECK (status IN ('submitted', 'accepted', 'completed', 'cancelled'));

ALTER TABLE orders ADD COLUMN order_number TEXT
  CHECK (
    order_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]-[0-9][0-9][0-9]'
    AND substr(order_number, 1, 6) = replace(substr(posting_date, 3), '-', '')
    AND substr(order_number, 8) <> '000'
  );

UPDATE orders
SET order_number = replace(substr(numbered.posting_date, 3), '-', '') || '-' || printf('%03d', numbered.serial)
FROM (
  SELECT id, posting_date,
    row_number() OVER (PARTITION BY business_id, posting_date ORDER BY rowid) AS serial
  FROM orders
) AS numbered
WHERE orders.id = numbered.id;

CREATE UNIQUE INDEX idx_orders_daily_number ON orders(business_id, posting_date, order_number);

CREATE TRIGGER orders_require_number
BEFORE INSERT ON orders
WHEN NEW.order_number IS NULL
BEGIN
  SELECT RAISE(ABORT, 'Order number is required');
END;
