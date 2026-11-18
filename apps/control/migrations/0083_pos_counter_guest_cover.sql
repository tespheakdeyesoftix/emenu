-- Preserve existing counts while removing the old table-only guest constraint.
-- The API still requires prompt_guest_cover for counter guest counts.
CREATE TABLE pos_guest_cover_0083_backup (
  sale_id TEXT PRIMARY KEY,
  guest_cover INTEGER NOT NULL
);
INSERT INTO pos_guest_cover_0083_backup (sale_id, guest_cover)
  SELECT id, guest_cover FROM sales WHERE guest_cover IS NOT NULL;

ALTER TABLE sales DROP COLUMN guest_cover;
ALTER TABLE sales ADD COLUMN guest_cover INTEGER
  CHECK (guest_cover IS NULL OR guest_cover BETWEEN 1 AND 1000);

UPDATE sales SET guest_cover = (
  SELECT b.guest_cover FROM pos_guest_cover_0083_backup b WHERE b.sale_id=sales.id
) WHERE id IN (SELECT sale_id FROM pos_guest_cover_0083_backup);
DROP TABLE pos_guest_cover_0083_backup;
