DROP INDEX idx_pos_open_table_bill;
DROP INDEX idx_pos_open_bill_day;
DROP INDEX idx_pos_open_bill_branch;
DROP INDEX idx_pos_paid_sales_by_day;
DROP TRIGGER pos_branch_deactivation_guard;
DROP TRIGGER pos_sale_product_status_insert;
DROP TRIGGER pos_sale_product_status_update;
DROP TRIGGER subscription_pos_daily_sale_import;
DROP TRIGGER subscription_pos_daily_sale_checkout;

ALTER TABLE sales RENAME COLUMN status TO previous_status;
ALTER TABLE sales ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open','submitted','bill_requested','paid','cancelled'));
UPDATE sales SET status=previous_status WHERE previous_status<>'open';
ALTER TABLE sales DROP COLUMN previous_status;

CREATE UNIQUE INDEX idx_pos_open_table_bill ON sales(business_id,profile_id,table_id)
  WHERE table_id IS NOT NULL AND status IN ('open','submitted','bill_requested');
CREATE INDEX idx_pos_open_bill_day ON sales(working_day_id) WHERE status IN ('open','submitted','bill_requested');
CREATE INDEX idx_pos_open_bill_branch ON sales(business_id,branch_id) WHERE status IN ('open','submitted','bill_requested');
CREATE INDEX idx_pos_paid_sales_by_day ON sales(business_id,business_date)
  WHERE status='paid' AND reverses_sale_id IS NULL;

CREATE TRIGGER pos_branch_deactivation_guard BEFORE UPDATE OF is_active ON branches
WHEN OLD.is_active=1 AND NEW.is_active=0 AND (
  EXISTS (SELECT 1 FROM working_days WHERE business_id=OLD.business_id AND branch_id=OLD.id AND closed_at IS NULL)
  OR EXISTS (SELECT 1 FROM cashier_shifts WHERE business_id=OLD.business_id AND branch_id=OLD.id AND closed_at IS NULL)
  OR EXISTS (SELECT 1 FROM sales WHERE business_id=OLD.business_id AND branch_id=OLD.id AND status IN ('open','submitted','bill_requested'))
)
BEGIN
  SELECT RAISE(ABORT,'POS_BRANCH_HAS_ACTIVITY');
END;

CREATE TRIGGER subscription_pos_daily_sale_import BEFORE INSERT ON sales
WHEN NEW.status='paid' AND NEW.reverses_sale_id IS NULL AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_daily_pos_sales IS NOT NULL
    AND (SELECT COUNT(*) FROM sales
         WHERE business_id=NEW.business_id AND business_date=NEW.business_date
           AND status='paid' AND reverses_sale_id IS NULL)>=p.max_daily_pos_sales
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_DAILY_POS_SALE_LIMIT');
END;

CREATE TRIGGER subscription_pos_daily_sale_checkout BEFORE UPDATE OF status ON sales
WHEN OLD.status<>'paid' AND NEW.status='paid' AND NEW.reverses_sale_id IS NULL AND EXISTS (
  SELECT 1 FROM business_subscriptions s JOIN subscription_plans p ON p.id=s.plan_id
  WHERE s.business_id=NEW.business_id AND p.max_daily_pos_sales IS NOT NULL
    AND (SELECT COUNT(*) FROM sales
         WHERE business_id=NEW.business_id AND business_date=NEW.business_date
           AND status='paid' AND reverses_sale_id IS NULL)>=p.max_daily_pos_sales
)
BEGIN
  SELECT RAISE(ABORT, 'PLAN_DAILY_POS_SALE_LIMIT');
END;
CREATE TRIGGER pos_sale_product_status_insert AFTER INSERT ON sale_products
WHEN NEW.status='new' AND (SELECT status FROM sales WHERE id=NEW.sale_id)<>'open'
BEGIN
  UPDATE sale_products SET status=CASE (SELECT status FROM sales WHERE id=NEW.sale_id) WHEN 'bill_requested' THEN 'submitted' ELSE (SELECT status FROM sales WHERE id=NEW.sale_id) END WHERE id=NEW.id;
END;
CREATE TRIGGER pos_sale_product_status_update AFTER UPDATE OF status ON sales
WHEN OLD.status<>NEW.status
BEGIN
  UPDATE sale_products SET status=CASE NEW.status WHEN 'open' THEN 'new' WHEN 'bill_requested' THEN 'submitted' ELSE NEW.status END
    WHERE sale_id=NEW.id AND status<>'void';
END;
