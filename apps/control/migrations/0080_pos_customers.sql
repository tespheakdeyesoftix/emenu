CREATE TABLE pos_customer_groups (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  UNIQUE (business_id,name)
);

ALTER TABLE pos_customers ADD COLUMN phone_number TEXT;
ALTER TABLE pos_customers ADD COLUMN address TEXT;
ALTER TABLE pos_customers ADD COLUMN customer_group_id TEXT
  REFERENCES pos_customer_groups(id) ON DELETE SET NULL;
ALTER TABLE pos_customers ADD COLUMN gender TEXT;
ALTER TABLE pos_customers ADD COLUMN dob TEXT;
ALTER TABLE pos_customers ADD COLUMN email TEXT;
ALTER TABLE pos_customers ADD COLUMN photo TEXT;

CREATE INDEX idx_pos_customer_group ON pos_customers(customer_group_id);
CREATE INDEX idx_pos_customer_name ON pos_customers(business_id,name COLLATE NOCASE,id);
