ALTER TABLE businesses ADD COLUMN disabled_control_pages_json TEXT NOT NULL DEFAULT '[]'
CHECK(json_valid(disabled_control_pages_json) AND json_type(disabled_control_pages_json) = 'array');
