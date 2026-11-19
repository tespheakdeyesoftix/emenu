ALTER TABLE products ADD COLUMN allow_discount INTEGER NOT NULL DEFAULT 1
  CHECK (allow_discount IN (0,1));
ALTER TABLE products ADD COLUMN allow_change_price INTEGER NOT NULL DEFAULT 1
  CHECK (allow_change_price IN (0,1));
ALTER TABLE products ADD COLUMN is_open_product INTEGER NOT NULL DEFAULT 0
  CHECK (is_open_product IN (0,1));
ALTER TABLE products ADD COLUMN allow_free INTEGER NOT NULL DEFAULT 1
  CHECK (allow_free IN (0,1));
