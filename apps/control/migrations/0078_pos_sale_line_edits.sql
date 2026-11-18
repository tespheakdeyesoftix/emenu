ALTER TABLE sale_products ADD COLUMN base_price_override_minor INTEGER
  CHECK (base_price_override_minor IS NULL OR base_price_override_minor >= 0);

ALTER TABLE sale_products ADD COLUMN is_free INTEGER NOT NULL DEFAULT 0
  CHECK (is_free IN (0, 1));
