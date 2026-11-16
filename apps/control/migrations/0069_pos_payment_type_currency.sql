ALTER TABLE pos_payment_types
ADD COLUMN currency TEXT CHECK (currency IS NULL OR currency IN ('USD','KHR'));
