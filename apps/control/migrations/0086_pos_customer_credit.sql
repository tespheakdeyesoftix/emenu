ALTER TABLE pos_customers ADD COLUMN allow_credit INTEGER NOT NULL DEFAULT 0
  CHECK (allow_credit IN (0,1));
