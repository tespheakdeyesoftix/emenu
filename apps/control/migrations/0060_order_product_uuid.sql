CREATE TABLE order_products_with_id (
  id TEXT NOT NULL PRIMARY KEY DEFAULT (
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', (random() & 3) + 1, 1) ||
    substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6)))
  ),
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
  portion_id TEXT,
  product_code TEXT,
  product_name TEXT,
  UNIQUE (order_id, line_number)
);

-- Omitting id assigns a UUID to every existing line, just as it does at checkout.
INSERT INTO order_products_with_id
  (order_id,line_number,product_id,quantity,price,portion_name,price_list,modifiers,total_amount,note,
   portion_id,product_code,product_name)
SELECT order_id,line_number,product_id,quantity,price,portion_name,price_list,modifiers,total_amount,note,
       portion_id,product_code,product_name
FROM order_products
ORDER BY rowid;

DROP TABLE order_products;
ALTER TABLE order_products_with_id RENAME TO order_products;
