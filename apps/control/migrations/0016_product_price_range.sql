PRAGMA foreign_keys = ON;

ALTER TABLE products ADD COLUMN max_price REAL NOT NULL DEFAULT 0
  CHECK(max_price >= 0);

UPDATE products
SET price_cents = COALESCE(
  (
    SELECT MIN(CAST(json_extract(portion.value, '$.priceCents') AS REAL))
    FROM json_each(products.portions_json) portion
    WHERE json_extract(portion.value, '$.priceCents') IS NOT NULL
  ),
  price_cents
)
WHERE json_valid(portions_json) AND json_array_length(portions_json) > 0;

UPDATE products
SET max_price = CASE
  WHEN json_valid(portions_json) AND json_array_length(portions_json) > 0
    THEN COALESCE(
      (
        SELECT MAX(CAST(json_extract(portion.value, '$.priceCents') AS REAL))
        FROM json_each(products.portions_json) portion
        WHERE json_extract(portion.value, '$.priceCents') IS NOT NULL
      ),
      price_cents
    )
  ELSE price_cents
END;

DELETE FROM product_prices
WHERE target_key = 'base'
  AND EXISTS (
    SELECT 1 FROM products product
    WHERE product.id = product_prices.product_id
      AND product.business_id = product_prices.business_id
      AND json_valid(product.portions_json)
      AND json_array_length(product.portions_json) > 0
  );

UPDATE businesses SET menu_cache_version = menu_cache_version + 1;

PRAGMA optimize;
