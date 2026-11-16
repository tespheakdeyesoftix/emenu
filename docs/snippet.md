how to delete product

Set-Location 'D:\Projects\eMenu\apps\control'

npx wrangler d1 execute angkor-emenu --local --persist-to .wrangler/state --command "DELETE FROM products; DELETE FROM categories; UPDATE businesses SET menu_cache_version = menu_cache_version + 1; SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM categories) AS categories;"
