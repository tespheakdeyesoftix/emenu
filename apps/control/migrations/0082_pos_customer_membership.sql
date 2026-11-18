ALTER TABLE pos_customers ADD COLUMN customer_code TEXT;
ALTER TABLE pos_customers ADD COLUMN is_membership INTEGER NOT NULL DEFAULT 0
  CONSTRAINT pos_customer_membership_requires_code
  CHECK (is_membership IN (0,1) AND (is_membership=0 OR length(trim(coalesce(customer_code,'')))>0));
