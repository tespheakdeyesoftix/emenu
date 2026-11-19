ALTER TABLE users ADD COLUMN permissions TEXT NOT NULL DEFAULT '{}'
  CHECK (json_valid(permissions) AND json_type(permissions)='object');
