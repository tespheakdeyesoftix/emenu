CREATE TABLE pos_customer_photos (
  customer_id TEXT PRIMARY KEY NOT NULL REFERENCES pos_customers(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  image BLOB NOT NULL CHECK (length(image) BETWEEN 1 AND 262144)
);
