# Angkor eMenu QR eMenu SaaS

A three-project Vue 3 + Cloudflare SaaS starter:

- `apps/control` — tenant management console and Cloudflare Worker API
- `apps/menu` — public QR menu at `https://menu.example.com/:businessSlug`
- `apps/site` — SaaS marketing, pricing, registration, and sign-in

## Quick start

```bash
npm install
npm run dev:api
npm run dev:control
npm run dev:menu
npm run dev:site
```

Local ports are API `8787`, control `5173`, menu `5174`, and website `5175`.
Copy each `.env.example` to `.env` when changing the API origin.

## Cloudflare resources

Create one D1 database and one R2 bucket, then replace the placeholder IDs in
`apps/control/wrangler.toml`. Apply the SQL in `apps/control/migrations` with
Wrangler. Deploy the Worker API first, then build and deploy the three web
surfaces to Cloudflare Pages (or serve their `dist` directories from Workers).

See [docs/tenant-isolation.md](docs/tenant-isolation.md) for the security model
and [docs/cloudflare-setup.md](docs/cloudflare-setup.md) for the exact D1/R2
provisioning and deployment steps.

For the complete production release process and copy-and-run commands, see
[docs/production-deployment.md](docs/production-deployment.md).

For releases that change the shared database or live customer menus, follow the
[staged production rollout](docs/production-deployment.md#6-staged-rollout-for-active-businesses).

## External POS catalog sync

The POS can send categories and products together to
`POST /api/integrations/pos/sync` with a business-specific API key. Category and
product IDs use the original POS UUIDs. The endpoint updates prices and menu
caching atomically and returns only a success message. Only `categories` and
`products` are required: sync metadata is generated when omitted, and currency
is resolved from the business associated with the API key.

All sync payload fields use snake_case, including nested option and pricing
fields (for example `sync_id`, `source_updated_at`, `name_km`, `price`,
`modifier_groups`, and `price_entries`).

See [docs/pos-catalog-sync.md](docs/pos-catalog-sync.md) for key setup, the complete
D1 field mapping, examples, limits and retry behavior. Run the isolated sync
integration tests with `npm run test:pos-sync`.

## Third-party POS operations

Use the [POS integration guide](docs/pos-api.md) and [OpenAPI contract](docs/pos-api.openapi.json)
to connect a register to eMenu. The API supports profile-bound staff sessions,
table and counter bills, overnight working days, cashier shifts, split USD/KHR
payments, and shift reconciliation. Run its integration suite with
`npm run test:pos-api`.
