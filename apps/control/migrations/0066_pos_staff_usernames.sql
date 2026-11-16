ALTER TABLE memberships ADD COLUMN pos_username TEXT CHECK (
  pos_username IS NULL OR (
    length(pos_username) BETWEEN 2 AND 40
    AND substr(pos_username, 1, 1) GLOB '[a-z0-9]'
    AND pos_username NOT GLOB '*[^a-z0-9_.-]*'
  )
);

CREATE UNIQUE INDEX memberships_pos_username
  ON memberships (business_id, pos_username)
  WHERE pos_username IS NOT NULL;
