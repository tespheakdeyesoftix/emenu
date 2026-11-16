ALTER TABLE businesses
ADD COLUMN secondary_currency TEXT NOT NULL DEFAULT 'USD'
CHECK(secondary_currency IN ('USD', 'KHR'));

ALTER TABLE businesses
ADD COLUMN secondary_exchange_rate REAL NOT NULL DEFAULT 0.00025
CHECK(secondary_exchange_rate > 0);

ALTER TABLE businesses
ADD COLUMN show_secondary_currency INTEGER NOT NULL DEFAULT 0
CHECK(show_secondary_currency IN (0, 1));

UPDATE businesses
SET secondary_currency = CASE WHEN currency = 'USD' THEN 'KHR' ELSE 'USD' END,
    secondary_exchange_rate = CASE
      WHEN currency = 'USD' THEN 4000
      ELSE 0.00025
    END;
