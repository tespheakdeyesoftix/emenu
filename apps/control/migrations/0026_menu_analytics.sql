PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN (
    'menu_open',
    'product_view',
    'favourite_add',
    'favourite_remove',
    'category_select',
    'search',
    'banner_impression',
    'banner_open',
    'banner_cta_click',
    'contact_click',
    'language_change'
  )),
  table_id TEXT,
  product_id TEXT,
  category_id TEXT,
  banner_id TEXT,
  entity_label TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'km' CHECK(language IN ('km','en','zh')),
  search_term TEXT NOT NULL DEFAULT '',
  search_result_count INTEGER,
  action_kind TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'general' CHECK(source_type IN ('general','table')),
  local_date TEXT NOT NULL,
  local_hour INTEGER NOT NULL CHECK(local_hour BETWEEN 0 AND 23),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_business_date
ON analytics_events(business_id, local_date, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_business_event_date
ON analytics_events(business_id, event_type, local_date);

CREATE INDEX IF NOT EXISTS idx_analytics_business_product_date
ON analytics_events(business_id, product_id, local_date);

CREATE INDEX IF NOT EXISTS idx_analytics_business_table_date
ON analytics_events(business_id, table_id, local_date);

CREATE INDEX IF NOT EXISTS idx_analytics_business_search_date
ON analytics_events(business_id, search_term, local_date)
WHERE event_type = 'search';

PRAGMA optimize;
