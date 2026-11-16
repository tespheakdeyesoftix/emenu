ALTER TABLE businesses ADD COLUMN map_label TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN wifi_ssid TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN wifi_password TEXT NOT NULL DEFAULT '';
ALTER TABLE businesses ADD COLUMN wifi_security TEXT NOT NULL DEFAULT 'wpa'
CHECK(wifi_security IN ('wpa', 'open'));
ALTER TABLE businesses ADD COLUMN show_header_location INTEGER NOT NULL DEFAULT 1
CHECK(show_header_location IN (0, 1));
ALTER TABLE businesses ADD COLUMN show_header_phones INTEGER NOT NULL DEFAULT 0
CHECK(show_header_phones IN (0, 1));
ALTER TABLE businesses ADD COLUMN show_header_wifi INTEGER NOT NULL DEFAULT 0
CHECK(show_header_wifi IN (0, 1));
ALTER TABLE businesses ADD COLUMN show_header_socials INTEGER NOT NULL DEFAULT 0
CHECK(show_header_socials IN (0, 1));
ALTER TABLE businesses ADD COLUMN show_header_tagline INTEGER NOT NULL DEFAULT 1
CHECK(show_header_tagline IN (0, 1));
