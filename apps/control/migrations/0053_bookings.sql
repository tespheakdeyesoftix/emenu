ALTER TABLE memberships ADD COLUMN can_view_bookings INTEGER NOT NULL DEFAULT 0
  CHECK (can_view_bookings IN (0,1));

CREATE UNIQUE INDEX idx_branches_business_booking ON branches(business_id,id);

CREATE TABLE business_booking_settings (
  business_id TEXT PRIMARY KEY NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  slot_minutes INTEGER NOT NULL DEFAULT 30 CHECK (slot_minutes BETWEEN 5 AND 240),
  notice_minutes INTEGER NOT NULL DEFAULT 120 CHECK (notice_minutes BETWEEN 0 AND 525600),
  advance_days INTEGER NOT NULL DEFAULT 30 CHECK (advance_days BETWEEN 0 AND 365),
  min_pax INTEGER NOT NULL DEFAULT 1 CHECK (min_pax BETWEEN 1 AND 1000),
  max_pax INTEGER NOT NULL DEFAULT 12 CHECK (max_pax BETWEEN min_pax AND 1000),
  terms_km TEXT NOT NULL DEFAULT '',
  terms_en TEXT NOT NULL DEFAULT '',
  terms_version TEXT NOT NULL DEFAULT '',
  telegram_enabled INTEGER NOT NULL DEFAULT 0 CHECK (telegram_enabled IN (0,1)),
  encrypted_token TEXT,
  revision INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE branch_booking_settings (
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0,1)),
  chat_id TEXT NOT NULL DEFAULT '',
  blocked_dates_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (business_id,branch_id),
  FOREIGN KEY (business_id,branch_id) REFERENCES branches(business_id,id) ON DELETE CASCADE
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  arrival_date TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  arrival_at TEXT NOT NULL,
  timezone TEXT NOT NULL,
  pax INTEGER NOT NULL CHECK (pax BETWEEN 1 AND 1000),
  guest_name TEXT NOT NULL,
  guest_phone TEXT NOT NULL,
  preference TEXT NOT NULL,
  preference_text TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','declined','cancelled')),
  terms_language TEXT NOT NULL CHECK (terms_language IN ('km','en')),
  terms_version TEXT NOT NULL,
  terms_text TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (business_id,submission_id),
  FOREIGN KEY (business_id,branch_id) REFERENCES branches(business_id,id)
);

CREATE INDEX idx_bookings_business_arrival ON bookings(business_id,arrival_date,arrival_time,id);
CREATE INDEX idx_bookings_branch_arrival ON bookings(business_id,branch_id,arrival_date,arrival_time,id);

CREATE TABLE telegram_booking_deliveries (
  booking_id TEXT PRIMARY KEY NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  error TEXT
);

CREATE INDEX idx_booking_deliveries_due ON telegram_booking_deliveries(next_attempt_at) WHERE status='pending';

CREATE TRIGGER enqueue_telegram_booking AFTER INSERT ON bookings
BEGIN
  INSERT INTO telegram_booking_deliveries (booking_id,chat_id)
  SELECT NEW.id,branch.chat_id FROM branch_booking_settings branch
  JOIN business_booking_settings settings ON settings.business_id=branch.business_id
  WHERE branch.business_id=NEW.business_id AND branch.branch_id=NEW.branch_id
    AND settings.telegram_enabled=1 AND settings.encrypted_token IS NOT NULL AND branch.chat_id<>'';
END;
