UPDATE businesses
SET currency = 'KHR', updated_at = CURRENT_TIMESTAMP
WHERE currency NOT IN ('USD', 'KHR');

PRAGMA optimize;
