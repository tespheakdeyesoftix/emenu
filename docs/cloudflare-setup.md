# Cloudflare D1, R2, and KV setup

Angkor eMenu uses native Worker bindings for these services. You do **not** need R2
S3 access keys when the API runs as a Cloudflare Worker.

## What you need

- A Cloudflare account with Workers enabled
- One D1 database, recommended name: `angkor-emenu`
- One R2 bucket, recommended name: `angkor-emenu-media`
- One Workers KV namespace, recommended name: `angkor-emenu-catalog-cache`
- The public hostname that will serve the API, for example `api.example.com`
- The production origins of the admin, public menu, and SaaS website

## Create the resources

From `apps/control`:

```powershell
npx wrangler login
npx wrangler d1 create angkor-emenu
npx wrangler r2 bucket create angkor-emenu-media
npx wrangler kv namespace create angkor-emenu-catalog-cache
```

The D1 command prints a `database_id`. Copy that value into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "angkor-emenu"
database_id = "YOUR_REAL_D1_DATABASE_ID"
migrations_dir = "migrations"
```

The R2 binding should be:

```toml
[[r2_buckets]]
binding = "MEDIA"
bucket_name = "angkor-emenu-media"
```

The catalog cache binding should be:

```toml
[[kv_namespaces]]
binding = "CATALOG_CACHE"
id = "YOUR_REAL_KV_NAMESPACE_ID"
```

For production images, open **Cloudflare Dashboard > R2 > angkor-emenu-media >
Settings > Custom Domains**, then connect a hostname that belongs to a domain in
the same Cloudflare account, such as `media.example.com`. Do not use the public
`r2.dev` development URL for production traffic.

Set the production origins and media URL:

```toml
[vars]
ALLOWED_ORIGINS = "https://admin.example.com,https://menu.example.com,https://example.com"
PUBLIC_ASSET_BASE = "https://api.example.com/media"
PUBLIC_MEDIA_BASE = "https://media.example.com"
```

`PUBLIC_MEDIA_BASE` has no path suffix: the API appends each R2 object key. If it
is omitted, Angkor eMenu safely falls back to the Worker `/media` route, which is
also used for local development. New uploads include a one-year immutable browser
cache policy because every upload receives a unique object key.

Public catalog JSON is cached in KV for 24 hours under a key containing the
business slug and active media hostname. Business, category, product, sorting,
and banner updates invalidate only that business's key. Browser responses use a
short 60-second cache so menu changes become visible quickly.

## Apply and deploy

```powershell
npx wrangler d1 migrations apply angkor-emenu --remote
npx wrangler deploy
```

Then set `VITE_API_BASE_URL=https://api.example.com` in each frontend build.

## Local development

Local D1 and R2 use `.wrangler/state`; they do not touch production:

```powershell
npm run db:migrate:local
npm run dev:api
```
