CREATE TABLE orders (
  id TEXT NOT NULL PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  posting_date TEXT NOT NULL,
  table_id TEXT NOT NULL REFERENCES restaurant_tables(id),
  total_quantity INTEGER NOT NULL CHECK (total_quantity > 0),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  currency TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  submission_hash TEXT NOT NULL,
  UNIQUE (business_id, table_id, submission_id)
);

CREATE INDEX idx_orders_business_posting_date ON orders(business_id, posting_date);

CREATE TABLE order_products (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  -- Catalog replacement can remove products and price lists. Keep their original IDs.
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price REAL NOT NULL CHECK (price >= 0),
  portion_name TEXT NOT NULL DEFAULT '',
  price_list TEXT NOT NULL,
  modifiers TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(modifiers) AND json_type(modifiers) = 'array'),
  total_amount REAL NOT NULL CHECK (total_amount >= 0),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (order_id, line_number)
);
