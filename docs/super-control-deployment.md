# Super-control deployment

The super-control application is a private Cloudflare Worker protected by
Cloudflare Access. It does not use the customer account system.

## First-time Cloudflare Access setup

1. Deploy the control Worker first so its `SuperAdminService` RPC entrypoint
   exists, then deploy `angkor-emenu-super-control`.
2. In **Cloudflare Dashboard > Workers & Pages**, select
   `angkor-emenu-super-control`, open **Access**, and protect production and
   preview deployments.
3. In Zero Trust, enable the **One-time PIN** identity provider if it is not
   already enabled.
4. Use an Allow policy matching only the exact email
   `pheakdey.micronet@gmail.com`. Set the Access session duration to one hour.
5. Copy the application Audience (AUD) tag and your Zero Trust team domain into
   `apps/super-control/wrangler.toml` as `ACCESS_AUD` and
   `ACCESS_TEAM_DOMAIN`, then deploy super-control again.

The super-control API denies requests while either Access value remains a
placeholder. It also validates the Access JWT and exact email itself, in
addition to Cloudflare's edge policy.

## Deploy

From the repository root:

```powershell
npm run deploy:all
```

The deployment applies D1 migrations, deploys the existing API Worker first,
then deploys super-control and the three public frontends.

## Local development

Apply the local migration and run both Workers using Wrangler's multi-config
mode, or run the existing API Worker and super-control Worker in separate
terminals. The `[access.dev]` identity in super-control's Wrangler file
simulates `pheakdey.micronet@gmail.com`; it is used only by local Wrangler.

For frontend development, run `npm run dev:api`, `npm run dev:super-worker`,
and `npm run dev:super` in separate terminals from the repository root. Open
`http://localhost:5176`. Vite forwards API requests to the super-control Worker
on port 8788. Its service binding connects to the Control Worker on port 8787.

# Branch webhooks

Enter the full public HTTPS endpoint, including any query parameters, in
**Webhook URL**. Use **Headers JSON** for credentials, custom headers, or a
custom `Content-Type`. Select JSON, raw text or form data, or no body.
For URL-encoded form data, enter the encoded body and set
`Content-Type` to `application/x-www-form-urlencoded`.
Deliveries to public HTTPS endpoints check DNS addresses before sending.
Webhook deliveries refuse redirects.

For local testing, add `WEBHOOK_ALLOW_LOCAL_HTTP=true` to
`apps/control/.dev.vars` and restart the local Control Worker. Use an HTTP URL
on `localhost`, a loopback address, or a private IPv4 address. Include the
receiver's port when needed, such as `http://192.168.10.19:1216/api/webhook`.
The receiver must be reachable from the machine running the Control Worker.

Apply D1 migrations through `0062_webhook_body_format.sql` before deploying the Control Worker
and then Super Control. Open **Businesses → Business detail → Branches →
Webhooks** to configure the branch. New rules are disabled until enabled.
Use `X-EMenu-Delivery-Id` to deduplicate retries at the receiver. The same value
is sent as `Idempotency-Key` unless the rule provides its own value.
The order or booking write is committed before delivery is attempted.
Rendered request bodies are limited to 256 KB. An oversized payload appears
as a failed delivery in Super Control.
Delivery history shows the latest five entries for the branch. The minute
scheduler deletes entries 24 hours after they were queued. Apply
`0070_webhook_history.sql` before deploying this version. Use **Clear logs**
to clear history for one webhook, the current branch, or the whole business.
Queued deliveries can add new entries when they run.
