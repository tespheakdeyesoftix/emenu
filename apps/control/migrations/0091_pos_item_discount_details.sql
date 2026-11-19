ALTER TABLE sale_products ADD COLUMN discount_bps INTEGER
  CHECK (discount_bps BETWEEN 1 AND 10000);
ALTER TABLE sale_products ADD COLUMN discount_note TEXT;
