ALTER TABLE order_products RENAME COLUMN status TO previous_status;

ALTER TABLE order_products ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted'
  CHECK (status IN ('submitted', 'accepted', 'rejected'));

UPDATE order_products
SET status = CASE previous_status WHEN 'confirmed' THEN 'accepted' ELSE previous_status END
WHERE previous_status <> 'submitted';

ALTER TABLE order_products DROP COLUMN previous_status;
