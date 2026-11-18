ALTER TABLE sales ADD COLUMN tax_rule_json TEXT CHECK (tax_rule_json IS NULL OR json_valid(tax_rule_json));
ALTER TABLE sales ADD COLUMN discount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tax_1_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tax_2_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN tax_3_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN total_tax_amount INTEGER GENERATED ALWAYS AS (tax_1_amount + tax_2_amount + tax_3_amount) VIRTUAL;
ALTER TABLE sales ADD COLUMN total_amount INTEGER GENERATED ALWAYS AS (subtotal_minor - discount_minor + total_tax_amount) VIRTUAL;

ALTER TABLE sale_products ADD COLUMN discount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_products ADD COLUMN tax_1_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_products ADD COLUMN tax_2_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_products ADD COLUMN tax_3_amount INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sale_products ADD COLUMN total_tax_amount INTEGER GENERATED ALWAYS AS (tax_1_amount + tax_2_amount + tax_3_amount) VIRTUAL;
ALTER TABLE sale_products ADD COLUMN total_amount INTEGER GENERATED ALWAYS AS (subtotal_minor - discount_minor + total_tax_amount) VIRTUAL;

-- Before multi-level rules, all recorded tax belonged to a single level.
UPDATE sales SET tax_1_amount=tax_minor WHERE tax_minor<>0;
UPDATE sale_products SET tax_1_amount=tax_minor WHERE tax_minor<>0;
