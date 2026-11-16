CREATE TABLE menu_product_exclusions (
  business_id TEXT NOT NULL,
  menu_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  PRIMARY KEY (business_id, menu_id, product_id),
  FOREIGN KEY (business_id, menu_id) REFERENCES menus(business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, product_id) REFERENCES products(business_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_product_exclusions_product ON menu_product_exclusions(business_id, product_id);
