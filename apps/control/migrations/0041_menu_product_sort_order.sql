ALTER TABLE menu_products ADD COLUMN sort_order INTEGER
CHECK (sort_order IS NULL OR sort_order >= 0);
