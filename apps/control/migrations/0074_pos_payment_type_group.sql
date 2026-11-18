ALTER TABLE pos_payment_types
ADD COLUMN payment_type_group TEXT CHECK (
  payment_type_group IS NULL OR CASE payment_type_group
    WHEN 'Cash' THEN kind = 'cash'
    WHEN 'Credit Card' THEN kind = 'card'
    WHEN 'Bank' THEN kind = 'other'
    WHEN 'QR Payment' THEN kind = 'qr'
    WHEN 'Other' THEN kind = 'other'
    ELSE 0
  END
);

UPDATE pos_payment_types SET payment_type_group = CASE kind
  WHEN 'cash' THEN 'Cash'
  WHEN 'card' THEN 'Credit Card'
  WHEN 'qr' THEN 'QR Payment'
  ELSE 'Other'
END;
