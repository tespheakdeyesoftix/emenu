ALTER TABLE order_products ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted'
  CHECK (status IN ('submitted', 'confirmed', 'rejected'));
