ALTER TABLE cashier_shifts ADD COLUMN base_currency TEXT;
ALTER TABLE cashier_shifts ADD COLUMN exchange_rate TEXT;
ALTER TABLE cashier_shifts ADD COLUMN business_date TEXT;
ALTER TABLE cashier_shifts ADD COLUMN opening_sequence INTEGER;
ALTER TABLE working_days ADD COLUMN base_currency TEXT;
ALTER TABLE cash_floats ADD COLUMN reason_code TEXT;

CREATE TABLE cashier_shift_reopens (
  id TEXT PRIMARY KEY NOT NULL,
  shift_id TEXT NOT NULL REFERENCES cashier_shifts(id) ON DELETE CASCADE,
  reopened_at TEXT NOT NULL,
  reopened_by TEXT NOT NULL,
  reason TEXT NOT NULL,
  previous_closed_at TEXT NOT NULL,
  previous_closed_by TEXT NOT NULL,
  previous_counts_json TEXT NOT NULL CHECK (json_valid(previous_counts_json))
);
CREATE INDEX idx_pos_shift_reopens ON cashier_shift_reopens(shift_id,reopened_at,id);
