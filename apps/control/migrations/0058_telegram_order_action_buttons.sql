ALTER TABLE telegram_notifications ADD COLUMN show_accept_button INTEGER NOT NULL DEFAULT 1
  CHECK (show_accept_button IN (0,1));
ALTER TABLE telegram_notifications ADD COLUMN accept_url TEXT NOT NULL DEFAULT '';
ALTER TABLE telegram_notifications ADD COLUMN show_cancel_button INTEGER NOT NULL DEFAULT 1
  CHECK (show_cancel_button IN (0,1));
ALTER TABLE telegram_notifications ADD COLUMN cancel_url TEXT NOT NULL DEFAULT '';
