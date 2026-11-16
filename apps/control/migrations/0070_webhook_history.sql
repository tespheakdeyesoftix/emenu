ALTER TABLE branch_webhook_deliveries
ADD COLUMN history_hidden INTEGER NOT NULL DEFAULT 0 CHECK (history_hidden IN (0, 1));
