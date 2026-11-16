CREATE UNIQUE INDEX idx_branches_business_id ON branches(business_id,id);

CREATE TABLE pos_customers (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  external_reference TEXT,
  is_walk_in INTEGER NOT NULL DEFAULT 0 CHECK (is_walk_in IN (0,1)),
  UNIQUE (business_id,external_reference)
);
CREATE UNIQUE INDEX idx_pos_walk_in ON pos_customers(business_id) WHERE is_walk_in=1;
CREATE INDEX idx_pos_customers_business ON pos_customers(business_id,id);

CREATE TABLE pos_payment_types (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  kind TEXT NOT NULL CHECK (kind IN ('cash','card','qr','other')),
  UNIQUE (business_id,name)
);

CREATE TABLE pos_profiles (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  config_json TEXT NOT NULL CHECK (json_valid(config_json)),
  pending_config_json TEXT CHECK (json_valid(pending_config_json)),
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id,id),
  UNIQUE (business_id,branch_id,id),
  UNIQUE (business_id,branch_id,name),
  FOREIGN KEY (business_id,branch_id) REFERENCES branches(business_id,id) ON DELETE CASCADE
);

CREATE TABLE pos_profile_grants (
  business_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (business_id,profile_id,user_id),
  FOREIGN KEY (business_id,profile_id) REFERENCES pos_profiles(business_id,id) ON DELETE CASCADE,
  FOREIGN KEY (user_id,business_id) REFERENCES memberships(user_id,business_id) ON DELETE CASCADE
);

CREATE TABLE pos_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  profile_id TEXT,
  credential_version TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id,business_id) REFERENCES memberships(user_id,business_id) ON DELETE CASCADE,
  FOREIGN KEY (business_id,profile_id) REFERENCES pos_profiles(business_id,id) ON DELETE CASCADE
);
CREATE INDEX idx_pos_sessions_expiry ON pos_sessions(expires_at);

CREATE TABLE pos_login_limits (
  bucket TEXT PRIMARY KEY NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE TABLE working_days (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT,
  UNIQUE (business_id,branch_id,id),
  FOREIGN KEY (business_id,branch_id) REFERENCES branches(business_id,id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX idx_pos_open_day ON working_days(business_id,branch_id) WHERE closed_at IS NULL;
CREATE INDEX idx_pos_day_history ON working_days(business_id,branch_id,opened_at,id);

CREATE TABLE cashier_shifts (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  working_day_id TEXT,
  opened_at TEXT NOT NULL,
  opened_by TEXT NOT NULL,
  closed_at TEXT,
  closed_by TEXT,
  activity_revision INTEGER NOT NULL DEFAULT 1,
  payment_types_json TEXT NOT NULL CHECK (json_valid(payment_types_json)),
  UNIQUE (business_id,profile_id,id),
  FOREIGN KEY (business_id,branch_id,profile_id) REFERENCES pos_profiles(business_id,branch_id,id) ON DELETE CASCADE,
  FOREIGN KEY (business_id,branch_id,working_day_id) REFERENCES working_days(business_id,branch_id,id)
);
CREATE UNIQUE INDEX idx_pos_open_shift ON cashier_shifts(business_id,profile_id) WHERE closed_at IS NULL;
CREATE INDEX idx_pos_shift_history ON cashier_shifts(business_id,profile_id,opened_at,id);
CREATE INDEX idx_pos_shift_day ON cashier_shifts(working_day_id) WHERE closed_at IS NULL;

CREATE TABLE cash_floats (
  id TEXT PRIMARY KEY NOT NULL,
  shift_id TEXT NOT NULL REFERENCES cashier_shifts(id) ON DELETE CASCADE,
  payment_type_id TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','KHR')),
  kind TEXT NOT NULL CHECK (kind IN ('opening','cash_in','cash_out')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0 AND (kind='opening' OR amount_minor>0)),
  reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX idx_pos_floats_shift ON cash_floats(shift_id,created_at,id);
CREATE UNIQUE INDEX idx_pos_opening_cash ON cash_floats(shift_id,payment_type_id,currency) WHERE kind='opening';

CREATE TABLE cashier_shift_closing_counts (
  shift_id TEXT NOT NULL REFERENCES cashier_shifts(id) ON DELETE CASCADE,
  payment_type_id TEXT NOT NULL,
  payment_type_name TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','KHR')),
  expected_minor INTEGER NOT NULL,
  declared_minor INTEGER NOT NULL,
  variance_minor INTEGER GENERATED ALWAYS AS (declared_minor-expected_minor) STORED,
  PRIMARY KEY (shift_id,payment_type_id,currency)
);

CREATE TABLE sales (
  id TEXT PRIMARY KEY NOT NULL,
  business_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  working_day_id TEXT,
  shift_id TEXT,
  reverses_sale_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('open','paid','cancelled')),
  revision INTEGER NOT NULL DEFAULT 1,
  business_date TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD','KHR')),
  secondary_exchange_rate TEXT NOT NULL,
  tax_mode TEXT NOT NULL CHECK (tax_mode IN ('disabled','inclusive','exclusive')),
  tax_rate_bps INTEGER NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL,
  total_minor INTEGER NOT NULL,
  table_id TEXT,
  table_code TEXT,
  table_label TEXT,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  receipt_json TEXT NOT NULL CHECK (json_valid(receipt_json)),
  note TEXT,
  reason TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  settled_at TEXT,
  settled_by TEXT,
  UNIQUE (business_id,profile_id,id),
  FOREIGN KEY (business_id,branch_id,profile_id) REFERENCES pos_profiles(business_id,branch_id,id) ON DELETE CASCADE,
  FOREIGN KEY (business_id,branch_id,working_day_id) REFERENCES working_days(business_id,branch_id,id),
  FOREIGN KEY (business_id,profile_id,shift_id) REFERENCES cashier_shifts(business_id,profile_id,id),
  FOREIGN KEY (business_id,profile_id,reverses_sale_id) REFERENCES sales(business_id,profile_id,id)
);
CREATE UNIQUE INDEX idx_pos_open_table_bill ON sales(business_id,profile_id,table_id)
  WHERE table_id IS NOT NULL AND status='open';
CREATE INDEX idx_pos_sale_history ON sales(business_id,profile_id,business_date,created_at,id);
CREATE INDEX idx_pos_sale_created ON sales(business_id,profile_id,created_at,id);
CREATE INDEX idx_pos_sale_shift ON sales(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_pos_open_bill_day ON sales(working_day_id) WHERE status='open';
CREATE INDEX idx_pos_open_bill_branch ON sales(business_id,branch_id) WHERE status='open';
CREATE INDEX idx_pos_open_shift_branch ON cashier_shifts(business_id,branch_id) WHERE closed_at IS NULL;

CREATE TRIGGER pos_branch_deactivation_guard BEFORE UPDATE OF is_active ON branches
WHEN OLD.is_active=1 AND NEW.is_active=0 AND (
  EXISTS (SELECT 1 FROM working_days WHERE business_id=OLD.business_id AND branch_id=OLD.id AND closed_at IS NULL)
  OR EXISTS (SELECT 1 FROM cashier_shifts WHERE business_id=OLD.business_id AND branch_id=OLD.id AND closed_at IS NULL)
  OR EXISTS (SELECT 1 FROM sales WHERE business_id=OLD.business_id AND branch_id=OLD.id AND status='open')
)
BEGIN
  SELECT RAISE(ABORT,'POS_BRANCH_HAS_ACTIVITY');
END;

CREATE TABLE sale_products (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  product_code TEXT,
  product_name TEXT NOT NULL,
  portion_id TEXT,
  portion_name TEXT,
  price_list_id TEXT NOT NULL,
  modifiers_json TEXT NOT NULL CHECK (json_valid(modifiers_json)),
  quantity INTEGER NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  subtotal_minor INTEGER NOT NULL,
  tax_minor INTEGER NOT NULL,
  total_minor INTEGER NOT NULL,
  note TEXT,
  UNIQUE (sale_id,line_number)
);

CREATE TABLE sale_payments (
  id TEXT PRIMARY KEY NOT NULL,
  sale_id TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  payment_type_id TEXT NOT NULL,
  payment_type_name TEXT NOT NULL,
  payment_kind TEXT NOT NULL CHECK (payment_kind IN ('cash','card','qr','other')),
  currency TEXT NOT NULL CHECK (currency IN ('USD','KHR')),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('tender','change','reversal')),
  amount_minor INTEGER NOT NULL CHECK (
    (entry_type='tender' AND amount_minor>0) OR
    (entry_type='change' AND amount_minor<0 AND payment_kind='cash') OR
    entry_type='reversal'
  ),
  reference TEXT,
  reverses_payment_id TEXT REFERENCES sale_payments(id),
  UNIQUE (sale_id,line_number)
);

CREATE TABLE pos_commands (
  business_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL DEFAULT '{}',
  state_valid INTEGER NOT NULL CONSTRAINT POS_STATE_CONFLICT CHECK (state_valid=1),
  PRIMARY KEY (business_id,profile_id,idempotency_key),
  FOREIGN KEY (business_id,profile_id) REFERENCES pos_profiles(business_id,id) ON DELETE CASCADE
);
