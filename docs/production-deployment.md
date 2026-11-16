# Angkor eMenu production deployment

This guide deploys the production services:

| Service        | Cloudflare resource        | Production URL                                           |
| -------------- | -------------------------- | -------------------------------------------------------- |
| Worker API     | Worker `angkor-emenu-api`  | `https://angkor-emenu-api.pheakdey-micronet.workers.dev` |
| Management app | Pages `angkor-emenu-admin` | `https://angkor-emenu-admin.pages.dev`                   |
| Public QR menu | Pages `angkor-emenu-menu`  | `https://angkor-emenu-menu.pages.dev`                    |
| SaaS website   | Pages `angkor-emenu`       | `https://angkor-emenu.pages.dev`                         |
| Super control  | Worker `angkor-emenu-super-control` | `https://angkor-emenu-super-control.pheakdey-micronet.workers.dev` |

The API uses the production D1 database `angkor-emenu`, the R2 bucket
`angkor-emenu-media`, and Workers KV for per-business public catalog caching.

## 1. Requirements

Install Node.js 20 or newer, then open PowerShell in the project folder:

```powershell
Set-Location D:\Projects\eMenu
npm install
```

Authenticate Wrangler and confirm the selected Cloudflare account:

```powershell
npx wrangler login
npx wrangler whoami
```

Run `wrangler login` only when Wrangler says you are not authenticated or you need to change accounts.

The authentication flow is compatible with the Workers Free plan. Password
derivation runs in the browser and the API protects the result with a private
Worker secret and a per-user salt. The raw password is never sent to the API.

## 2. One-time Cloudflare setup

The current production account already has these resources. Do not recreate them for a normal deployment.

To verify them:

```powershell
Push-Location apps\control
npx wrangler d1 list
npx wrangler r2 bucket list
npx wrangler kv namespace list
Pop-Location

npx wrangler pages project list
```

For a completely new Cloudflare account, create D1, R2, and KV once:

```powershell
Push-Location apps\control
npx wrangler d1 create angkor-emenu
npx wrangler r2 bucket create angkor-emenu-media
npx wrangler kv namespace create angkor-emenu-catalog-cache
Pop-Location
```

Copy the `database_id` printed by the D1 command into `apps/control/wrangler.toml`. Keep these binding names unchanged:

```toml
[[d1_databases]]
binding = "DB"
database_name = "angkor-emenu"
database_id = "YOUR_D1_DATABASE_ID"
migrations_dir = "migrations"

[[kv_namespaces]]
binding = "CATALOG_CACHE"
id = "YOUR_KV_NAMESPACE_ID"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "angkor-emenu-media"
```

Create the three Pages projects only once. With Wrangler 4.139, run each command from its app directory and use `--force` only during project creation:

```powershell
Push-Location apps\site
npx wrangler pages project create angkor-emenu --production-branch main --force
Pop-Location

Push-Location apps\control
npx wrangler pages project create angkor-emenu-admin --production-branch main --force
Pop-Location

Push-Location apps\menu
npx wrangler pages project create angkor-emenu-menu --production-branch main --force
Pop-Location
```

Do not run these create commands again when the projects already appear in `wrangler pages project list`.

## 3. Production configuration

The Worker production values in `apps/control/wrangler.toml` must use the deployed frontend origins:

```toml
[vars]
ALLOWED_ORIGINS = "https://angkor-emenu-admin.pages.dev,https://angkor-emenu-menu.pages.dev,https://angkor-emenu.pages.dev"
PUBLIC_ASSET_BASE = "https://angkor-emenu-api.pheakdey-micronet.workers.dev/media"
```

The production KV namespace is already configured as
`36a52e3abba94a4e87a5d35ad505cf10`. It caches one public catalog per business
slug and is invalidated automatically when that business updates its profile,
categories, menu items, ordering, or banners.

### Optional but recommended: direct R2 image delivery

In Cloudflare Dashboard, open **R2 > angkor-emenu-media > Settings > Custom
Domains** and attach a hostname on a domain in this Cloudflare account, for
example `media.yourdomain.com`. Then add this line under `[vars]` in
`apps/control/wrangler.toml`:

```toml
PUBLIC_MEDIA_BASE = "https://media.yourdomain.com"
```

Do not add `/media` to this URL. With this value set, public QR-menu responses
contain direct R2 custom-domain URLs; without it they continue to use the safe
Worker image route. The `r2.dev` URL is intended for development and should not
be used for the production menu.

The management app uses `apps/control/.env.production`:

```dotenv
VITE_API_BASE_URL=https://angkor-emenu-api.pheakdey-micronet.workers.dev
```

The QR menu uses `apps/menu/.env.production`:

```dotenv
VITE_API_BASE_URL=https://angkor-emenu-api.pheakdey-micronet.workers.dev
```

The SaaS website uses `apps/site/.env.production`:

```dotenv
VITE_API_BASE_URL=https://angkor-emenu-api.pheakdey-micronet.workers.dev
VITE_ADMIN_URL=https://angkor-emenu-admin.pages.dev
VITE_MENU_URL=https://angkor-emenu-menu.pages.dev
```

Local Worker values are kept in `apps/control/.dev.vars`, so production CORS configuration does not prevent the localhost apps from accessing the local API.

### Create the authentication secret once

Before the first API deployment, create its private authentication pepper:

```powershell
Set-Location D:\Projects\eMenu
npm run auth:setup
```

The command generates a cryptographically random secret, sends it directly to
Cloudflare, and does not display it. If the secret already exists, the command
exits without changing it. Never manually replace `AUTH_PEPPER` after users
register: replacing it invalidates every stored password hash and requires all
users to reset their passwords.

## 4. Normal deployment after making changes

Run each step separately from PowerShell. For a release that changes the shared
database or live customer menus, use the [staged rollout](#6-staged-rollout-for-active-businesses).

### Step 1: install, check, and build

```powershell
Set-Location D:\Projects\eMenu
npm install
npm run typecheck
npm run build
```

Do not deploy if type checking or the build reports an error.

### Step 2: apply D1 migrations

Check pending migrations first, then apply them to the remote production database:

```powershell
Push-Location apps\control
npx wrangler d1 migrations list angkor-emenu --remote
npx wrangler d1 migrations apply angkor-emenu --remote
Pop-Location
```

`No migrations to apply` is a successful result. Never use `--local` for the production database.

Migrations do not upload the built-in TypeScript demo catalog. They only update the D1 schema. Existing restaurant data remains in D1 unless a migration explicitly changes or deletes it.

### Step 3: deploy the API Worker

```powershell
Push-Location apps\control
npx wrangler deploy
Pop-Location
```

Confirm that Wrangler reports both bindings:

- `env.DB (angkor-emenu)`
- `env.MEDIA (angkor-emenu-media)`
- `env.CATALOG_CACHE (36a52e3abba94a4e87a5d35ad505cf10)`

It should finish with this Worker URL:

```text
https://angkor-emenu-api.pheakdey-micronet.workers.dev
```

### Step 4: deploy the management app

```powershell
Push-Location apps\control
npx wrangler pages deploy dist --project-name angkor-emenu-admin --branch main
Pop-Location
```

The warning that `wrangler.toml` has no `pages_build_output_dir` can be ignored for this command because `dist` and the Pages project name are supplied explicitly.

### Step 5: deploy the QR menu

```powershell
Push-Location apps\menu
npx wrangler pages deploy dist --project-name angkor-emenu-menu --branch main
Pop-Location
```

### Step 6: deploy the SaaS website

```powershell
Push-Location apps\site
npx wrangler pages deploy dist --project-name angkor-emenu --branch main
Pop-Location
```

Wrangler prints a unique preview deployment URL. The stable `*.pages.dev` production URL will point to the new `main` deployment.

## 5. One-command deployment

After the one-time setup and `npm install` are complete, deploy everything with:

```powershell
Set-Location D:\Projects\eMenu
npm run deploy:all
```

The command runs these operations in order, with no smoke-test pause between live changes:

1. Type-checks all four applications.
2. Builds all four frontends and validates both Workers.
3. Applies pending migrations to the remote `angkor-emenu` D1 database.
4. Deploys the API Worker.
5. Deploys the private super-control Worker.
6. Deploys the management app to Pages.
7. Deploys the QR menu to Pages.
8. Deploys the SaaS website to Pages.

It stops immediately when any operation fails, so later services are not deployed after a failed check, build, migration, or upload. Run `npm install` first if it reports that dependencies are missing.

`npx wrangler deploy:all` is not available because Wrangler does not support project-defined subcommands. The project-level equivalent is `npm run deploy:all`.

## 6. Staged rollout for active businesses

Run each stage separately and stop if a check fails. Start with the local build
and isolated Worker integration tests.

```powershell
Set-Location D:\Projects\eMenu

npm run typecheck
npm run build
node --test --test-concurrency=1 tests/orders.test.mjs tests/pos-sync.test.mjs
```

Record the active Worker version IDs and Pages deployment IDs in Cloudflare.
Capture a baseline for each active business using its public catalog endpoint,
Pages link, and any custom hostname. Record category and product counts, then
check representative prices, images, printed QR links, and an existing Control
session. Use a separate test business for write operations.

Review the pending migrations and rehearse them on an isolated database with
existing records. Record a fresh D1 Time Travel bookmark immediately before
applying the reviewed migrations. Check the existing menus and Control against
the still-live Worker before moving on.

```powershell
Push-Location apps\control
npx wrangler d1 migrations list angkor-emenu --remote
npx wrangler d1 time-travel info angkor-emenu
# Run separately after reviewing the migration list and recording the bookmark.
npx wrangler d1 migrations apply angkor-emenu --remote
Pop-Location
```

Upload the candidate API version. Compare it to the baseline using read-only
checks because its version URL uses the production bindings. Start the traffic
split with a small share on the candidate and monitor Worker errors and catalog
responses. Promote the API to 100% before releasing the apps that call its new
endpoints. [Cloudflare gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/)

```powershell
Push-Location apps\control
npx wrangler versions upload
# Smoke-test the candidate before running the interactive deployment command.
npx wrangler versions deploy
Pop-Location
```

Deploy super-control and verify Cloudflare Access and its business list. Publish
Control and the QR menu separately using the Pages commands above. Check existing
Control sessions immediately after publishing Control, then check public QR links
and custom domains immediately after publishing the menu. Skip the website
deployment when its build matches production.

For the orders and POS release, leave order submission disabled and POS keys
unprovisioned for existing businesses. Exercise those features on the test
business before enabling them for individual businesses.

### Branch and menu release

Rehearse `0039_branches_and_menus.sql` with existing businesses, table groups,
tables, orders and analytics. After applying it, check that each business has
exactly one active default branch and that the existing groups, tables, orders
and analytics have branch IDs. Compare existing table IDs and QR tokens with
the baseline. Check the original category catalog and a printed table QR
against the still-live Worker before promoting the candidate.

Deploy the Worker, then the public menu Pages project so customer links can
resolve branch and menu selections. Deploy Super Control and Control after
that. In a test business, create a second branch in Super Control, create two
menus in Control, and print test table links for each. Confirm menu contents,
branch ordering radius, and the branch shown on the saved orders. Once scoped
QR links are distributed, use rollback versions of the Worker and public menu
that understand `branch` and `menu`. Keep the additive D1 migration applied
during an application rollback.

## 7. Verify production

Check the API and all three websites:

```powershell
curl.exe -I https://angkor-emenu-api.pheakdey-micronet.workers.dev/health
curl.exe -I https://angkor-emenu-admin.pages.dev
curl.exe -I https://angkor-emenu-menu.pages.dev/emenu
curl.exe -I https://angkor-emenu.pages.dev
```

Each command should return `HTTP/1.1 200 OK` or `HTTP/2 200`.

Then manually confirm these workflows:

1. Open the SaaS website and select **See it in action**. It should open the QR menu in a new tab.
2. Register a test business or sign in to the management app.
3. Create a category and menu item.
4. Upload a small image. If `PUBLIC_MEDIA_BASE` is configured, confirm its URL
   uses the R2 custom domain; otherwise confirm the Worker `/media/...` fallback.
5. Open the business slug in the QR menu and confirm the saved D1 data appears.

Check the catalog cache twice (replace the slug):

```powershell
curl.exe -sS -D - -o NUL https://angkor-emenu-api.pheakdey-micronet.workers.dev/api/public/businesses/your-business-slug/menu
```

The first uncached request returns `x-catalog-cache: MISS`; later requests return
`x-catalog-cache: HIT`. Saving catalog data clears that business's cache, so the
next request returns `MISS` and rebuilds it from D1.

## 8. Local development after production deployment

Production and local URLs are intentionally separate. Start all local services from different terminals:

```powershell
npm run dev:api
npm run dev:control
npm run dev:menu
npm run dev:site
```

Local ports are:

- API: `http://localhost:8787`
- Management: `http://localhost:5173`
- QR menu: `http://localhost:5174`
- SaaS website: `http://localhost:5175`

Apply migrations to the local database with:

```powershell
npm run db:migrate:local
```

This command uses local Miniflare storage and does not update production D1.

## 9. Common deployment problems

### Wrangler says you are not logged in

```powershell
npx wrangler login
npx wrangler whoami
```

### Pages project creation detects the workspace root

Run the command from the relevant `apps/site`, `apps/control`, or `apps/menu` directory. Use `--force` only for the initial Pages project creation, not for normal deployments.

### The browser reports a CORS error

Confirm the exact frontend origin is present in `ALLOWED_ORIGINS` inside `apps/control/wrangler.toml`, then redeploy the Worker:

```powershell
Push-Location apps\control
npx wrangler deploy
Pop-Location
```

Origins must not have a trailing slash.

### Registration says `Request could not be completed`

Confirm that the authentication secret was created, then redeploy the API and
both frontends that contain the authentication client:

```powershell
Set-Location D:\Projects\eMenu
npm run auth:setup
npm run deploy:all
```

For normal later deployments, run only `npm run deploy:all`. The setup command
is safe to check again because it will not overwrite an existing secret.

If registration still fails, stream the API's structured production logs and
submit the form once more:

```powershell
Push-Location apps\control
npx wrangler tail angkor-emenu-api --format pretty
Pop-Location
```

The failed response now includes a `requestId`; the same ID appears in the
Worker log without logging the submitted password.

### A registered owner cannot sign in

Deploy the current API first, then run the protected password recovery command
from the repository root. It asks for the password privately in the terminal
and never writes or prints it:

```powershell
Set-Location D:\Projects\eMenu
npm run deploy:all
npm run auth:reset-password -- --email owner@example.com
```

If the address was mistyped during registration, correct it during the same
reset:

```powershell
npm run auth:reset-password -- --email old@example.com --new-email correct@example.com
```

The command creates a random, short-lived Worker recovery secret, resets only
the matching account, optionally corrects its email, signs out its existing
sessions, and removes the recovery secret immediately afterward. It does not
delete the business, catalog, media, or QR menu data.

### The frontend still calls localhost

Check the relevant `.env.production` file, rebuild that app, and deploy its new `dist` folder. Vite copies environment values into the JavaScript during the build, so changing the file without rebuilding is not enough.

### The menu says it is unavailable

The public route must contain a business slug that exists in production D1:

```text
https://angkor-emenu-menu.pages.dev/your-business-slug
```

The bare Pages hostname intentionally shows the unavailable state. A registered
business uses the slug selected during registration.

### Add a customer menu subdomain

Each business can have one manually managed custom subdomain. In Cloudflare,
open the `angkor-emenu-menu` Pages project, choose **Custom domains**, and add
the customer's hostname before changing DNS. Ask the customer to create a CNAME:

```text
emenu.customer-domain.com CNAME angkor-emenu-menu.pages.dev
```

Wait for the custom domain and TLS certificate to become active, then open the
business in super-control and save `https://emenu.customer-domain.com` under
**Customer menu domain**. Regenerate the business QR code after saving. Enter
only the HTTPS origin; paths, query strings, and fragments are rejected.

If the hostname is removed or changed, update super-control immediately so the
old hostname stops resolving to the business.

### A deployment must be rolled back

Cloudflare Pages keeps earlier deployments for each project. Open the Cloudflare dashboard, choose **Workers & Pages**, select the affected Pages project, open **Deployments**, and promote the last working deployment.

For the API Worker, view prior versions and use Wrangler's interactive rollback command:

```powershell
Push-Location apps\control
npx wrangler deployments list
npx wrangler rollback
Pop-Location
```

D1 migrations are separate from application rollback. Leave compatible migrations
in place when rolling back code. A Time Travel restore rolls back the whole
database, including business writes after the chosen bookmark. Review and
reconcile those writes before restoring. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/)
