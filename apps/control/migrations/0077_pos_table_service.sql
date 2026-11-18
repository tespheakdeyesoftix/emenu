ALTER TABLE sales ADD COLUMN guest_cover INTEGER
  CHECK (guest_cover IS NULL OR (table_id IS NOT NULL AND guest_cover BETWEEN 1 AND 1000));

ALTER TABLE bookings ADD COLUMN table_id TEXT REFERENCES restaurant_tables(id) ON DELETE SET NULL;

CREATE INDEX idx_bookings_table_arrival ON bookings(business_id,branch_id,table_id,arrival_at)
  WHERE status='confirmed' AND table_id IS NOT NULL;
