DROP TRIGGER pos_sale_product_status_insert;
DROP TRIGGER pos_sale_product_status_update;
ALTER TABLE sale_products RENAME COLUMN status TO old_status;
ALTER TABLE sale_products ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
  CHECK(status IN ('new','submitted','void','paid','cancelled'));
ALTER TABLE sale_products ADD COLUMN line_key TEXT;
ALTER TABLE sale_products ADD COLUMN order_session TEXT;
ALTER TABLE sale_products ADD COLUMN ordered_at TEXT;
ALTER TABLE sale_products ADD COLUMN ordered_by TEXT;
ALTER TABLE sale_products ADD COLUMN ordered_by_name TEXT;
UPDATE sale_products SET status=CASE old_status WHEN 'open' THEN 'new' ELSE old_status END,
  line_key='legacy_' || line_number, order_session=sale_id,
  ordered_at=(SELECT created_at FROM sales WHERE id=sale_id),
  ordered_by=(SELECT created_by FROM sales WHERE id=sale_id),
  ordered_by_name=(SELECT u.display_name FROM sales s JOIN users u ON u.id=s.created_by WHERE s.id=sale_products.sale_id);
ALTER TABLE sale_products DROP COLUMN old_status;
CREATE UNIQUE INDEX idx_sale_line_key ON sale_products(sale_id,line_key);
CREATE TRIGGER pos_sale_product_status_insert AFTER INSERT ON sale_products
WHEN NEW.status='new' AND (SELECT status FROM sales WHERE id=NEW.sale_id)<>'open'
BEGIN
  UPDATE sale_products SET status=(SELECT status FROM sales WHERE id=NEW.sale_id) WHERE id=NEW.id;
END;
CREATE TRIGGER pos_sale_product_status_update AFTER UPDATE OF status ON sales
WHEN OLD.status<>NEW.status
BEGIN
  UPDATE sale_products SET status=CASE NEW.status WHEN 'open' THEN 'new' ELSE NEW.status END
    WHERE sale_id=NEW.id AND status<>'void';
END;
