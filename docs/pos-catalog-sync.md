# POS category and product sync

The POS (or a connector running alongside it) sends categories and products to
the catalog endpoint. For changes to one product, use the [product webhook](#single-product-webhook).
If your POS has separate category and product APIs, fetch
**all pages of both APIs**, map their fields to the format below, and submit the
combined catalog. eMenu does not need access to your POS database.

```text
POS category API ─┐
                 ├─ POS/connector ─ POST /api/integrations/pos/sync ─ eMenu
POS product API ─┘
```

## 1. Prepare the API

From the project root, apply the migration to your **local** database:

```powershell
npm run db:migrate:local
npm run dev:api
```

If the API is already running, apply the migration without starting a second
server. The development API is `http://localhost:8787`.

### Access from a POS on another LAN computer

Keep the API running with `npm run dev:api`. In a second terminal, run
`npm run dev:api:lan` when Frappe runs on another computer. This adds a listener
bound specifically to `192.168.10.179:8787`, forwarding `/health` and the catalog,
product, and table sync endpoints to the localhost API. Admin, authentication and
Wrangler development/explorer routes stay on localhost.

The LAN listener also forwards the [POS online order endpoints](pos-online-orders.md).

To use a different address assigned to the API computer, run
`node scripts/serve-pos-lan.mjs --host YOUR_LAN_IP` from the project root. The
listener accepts one specific local LAN IPv4 address, not a wildcard address.

For a Windows host at `192.168.10.179`, check
`http://192.168.10.179:8787/health`, and set the Frappe site's
`emenu_integration.api_url` to `http://192.168.10.179:8787`. Use the host's actual
LAN IP if it changes. `localhost` in Frappe's configuration refers to the Frappe
server itself. The API root is not a web page; use `/health` to check connectivity.
If the request succeeds on the API computer but times out from Frappe, check the
Windows firewall/network rules for inbound TCP 8787 from the Frappe host.

With explicit approval and Windows administrator rights, the prepared
`scripts/allow-pos-lan.ps1` can add an inbound allow rule for `node.exe`, limited
to the specified Frappe source IP, API destination IP and TCP port 8787. Its
defaults are Frappe `192.168.10.19` and API `192.168.10.179`. Review the script
before running it from an administrator PowerShell. It does not disable the
firewall or open other ports.

Production requires the latest D1 migrations, including `0033_pos_table_sync.sql`,
and the updated API Worker. Follow [production-deployment.md](production-deployment.md). The
configured production API is
`https://angkor-emenu-api.pheakdey-micronet.workers.dev`. Local setup does not
deploy or modify production.

## 2. Create a business-specific POS API key

In **super-control**, open **Businesses → select the business → POS integration**.
Enter an integration name and click **Create API key**. Copy the key from the
one-time dialog into the POS server's secret settings. This panel also shows the
sync endpoint, key prefix and last successful sync time. **Rotate API key** and
**Revoke API key** both ask for confirmation before invalidating the current key.
Refreshing or leaving the page clears the revealed key; it is not saved in
browser storage. Super-admin key changes are recorded in the audit log without
the secret value.

The super-control panel uses Cloudflare Access and the Worker service binding,
so it does not require a customer/owner login. Its protected API is
`/api/super/businesses/:businessId/pos-integration` (`GET`, `PUT`, `DELETE`).
The `GET` response includes the nonsecret `integration` metadata and `syncUrl`;
`PUT` additionally returns the newly issued `apiKey` once. `DELETE` revokes the
connection while keeping catalog data. Super-admins can manage keys for a
disabled or expired business, but the sync API still blocks that business's
catalog writes.

Business owners can alternatively create a key using their existing admin API:

Sign in to the business dashboard as the business **owner**. In the browser's
developer console, run this code. Use the appropriate API origin for the
dashboard you signed into:

```javascript
const apiBase = "http://localhost:8787";
const result = await fetch(`${apiBase}/api/admin/integrations/pos`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("mf_token")}`,
  },
  body: JSON.stringify({ name: "My POS" }),
});
const connection = await result.json();
if (!result.ok) throw new Error(connection.error);
console.log(connection.apiKey);
```

Store the returned `pos_...` key in the POS server's secret configuration. It is
shown once. D1 stores only its SHA-256 hash. Each business has one POS connection.
Calling `PUT` again **rotates the key** and immediately invalidates the old key.
Keep the key on the POS server, outside public browser JavaScript and source
control. Use HTTPS for production requests.

The business is resolved from the key. Do not send a `business_id`, business slug,
owner password, or owner session token in sync requests. A POS key only authorizes
catalog sync; it cannot access the existing admin APIs or create more keys.

Other owner-authenticated management requests:

| Method   | Path                          | Purpose                                                                       |
| -------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `GET`    | `/api/admin/integrations/pos` | Connection name, key prefix, last sync/source times, creation time; no secret |
| `PUT`    | `/api/admin/integrations/pos` | Create/rotate the key; JSON body `{ "name": "My POS" }` or `{}`               |
| `DELETE` | `/api/admin/integrations/pos` | Disconnect and invalidate the key; catalog records remain                     |

## 3. Send a catalog

```http
POST /api/integrations/pos/sync
Authorization: Bearer pos_YOUR_KEY
Content-Type: application/json
```

```json
{
  "categories": [
    {
      "id": "3a1e3be5-6e40-4bb1-a775-07d6811d5143",
      "name_km": "ភេសជ្ជៈ",
      "name_en": "Drinks",
      "is_active": true
    }
  ],
  "products": [
    {
      "id": "a743e3c2-2838-4476-b4a4-5d920e4177ba",
      "category_id": "3a1e3be5-6e40-4bb1-a775-07d6811d5143",
      "code": "COFFEE-001",
      "name_km": "កាហ្វេទឹកកក",
      "name_en": "Iced coffee",
      "price": 2.5,
      "image_url": "https://pos.example.com/images/iced-coffee.webp",
      "is_available": true
    }
  ]
}
```

On a successful sync, the complete response is **HTTP 200**:

```json
{
  "message": "POS catalog synced successfully."
}
```

No categories, products, IDs, or catalog data are returned.

### Request envelope

Only **categories** and **products** are required. The API resolves the business
and its primary currency from the POS API key, and fills in missing sync metadata.
Your POS does not need to maintain a sync log to use this format.

| Field               | Type               | Rule                                                                                                                                                             |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `categories`        | array              | Required; 0–500 records.                                                                                                                                         |
| `products`          | array              | Required; 0–1,000 records.                                                                                                                                       |
| `sync_id`           | UUID string        | Optional. Generated by eMenu when omitted. Supply a stable UUID and resend the identical JSON body when you want exact request deduplication.                    |
| `source_updated_at` | ISO 8601 string    | Optional. If supplied, it must include a timezone and be newer than the last catalog sync and each included product's stored source timestamp.                   |
| `currency`          | `"USD"` or `"KHR"` | Not needed. Currency always comes from the business. An optional legacy hint is accepted only when it matches that business; it cannot change or convert prices. |

Without `sync_id`, each submission is recorded as a new sync. Repeated requests
upsert the same POS UUIDs, so they do not create duplicate categories/products,
but they may reapply values and refresh the menu cache again. Without
`source_updated_at`, the server cannot identify an old POS snapshot from its
contents; submit catalogs in order. Send these optional fields only if your POS
needs exact request deduplication or source-snapshot ordering checks.

At least one array must be nonempty. The UTF-8 JSON body limit is **8 MiB**.
300 products can be sent together. Internally the API prepares chunks of up to
50 rows (smaller for large records) and executes all writes in one D1 batch
transaction. Do not put image files or base64 image data in the JSON.

This is an **upsert/patch** API, not a replacement import:

- A new UUID inserts a record; an existing UUID updates it.
- Category and product `id` values are the actual POS UUIDs, stored in lowercase
  canonical UUID form as D1 primary keys. eMenu does not generate replacement IDs.
- UUIDs must be unique across businesses within each table. A UUID already owned
  by another business returns `409`; it is never reassigned.
- Omitted fields on existing records keep their values, including photos,
  translations, descriptions, display order and featured flags. Supplied fields
  overwrite those values. Keep eMenu-managed fields out of recurring POS payloads.
- Records missing from a request are left unchanged. Use `is_available: false`
  to hide a product or `is_active: false` to hide a category and its subtree.
- Both arrays are required even for a partial update; send `[]` for the unused
  array. Sync IDs and source timestamps can be omitted.
- Categories may arrive in any order. The API validates parents/cycles and writes
  parents before children. A product can reference a category in this request or
  one already belonging to this business. Category depth is limited to 32 levels.
- The API ignores extra keys on sync payloads and their nested records. It
  still validates recognized fields, including types, unique IDs/codes/slugs,
  and references to records owned by the business.

Category and product **`slug` is optional**. Omit it, send `null`, or send an empty
or whitespace-only string to let the sync API handle it. New records get a slug
generated from their name and POS UUID (for example `iced-coffee-<product-uuid>`).
Existing records keep their current slug when the value is omitted, null or blank,
even if the name changes. Supply a nonempty valid slug to change it explicitly.

### Important: price units

The payload field `price` maps to the existing D1 `price_cents` column. Its value is the **actual
amount in the business currency resolved from the API key**, not an integer minor-unit value:

- USD 2.50 → `"price": 2.5`
- KHR 10,000 → `"price": 10000`

If the POS sends USD integer cents, divide by 100 in the connector. Do not divide
KHR amounts by 100. Product prices, portion prices and price-list overrides must
be finite numbers from 0 to 1,000,000,000,000. Modifier option prices can be
negative, down to -1,000,000,000,000. For example, `"price": -0.5` on a
modifier lowers a USD 2.50 item to USD 2.00. The final item price must be at
least zero to submit an order.

Products, portions and modifier options use **`price`** in the sync payload.
Their former `price_cents`/`price_cent` keys are not accepted. The database column
`products.price_cents` and the existing internal option price fields are unchanged.
Price-list overrides in `price_entries` continue to use `price_cents`.

### Single-product webhook

After a product create or update commits in the POS, send a `POST` to
`/api/integrations/pos/sync/product` with `Content-Type: application/json` and
the same `Authorization: Bearer pos_...` header used for catalog sync. From
the Frappe LAN server, the full URL is
`http://192.168.10.179:8787/api/integrations/pos/sync/product`.

Send a single `product` object using the [same product fields](#5-product-fields-complete-d1-mapping).
The product UUID identifies the record to insert or update. For a new product,
send its name, price (or portions), and `category_id`. If the category is new,
include it and any missing parents in an optional `categories` array of up to
500 rows. Use the [same category fields](#4-category-fields-complete-d1-mapping).
The API validates the hierarchy and saves parents, children, and the product in
one transaction. The rows can appear in any order.

```json
{
  "categories": [
    {
      "id": "c3993d7e-48f7-467a-9f91-6be206295f68",
      "name_en": "Drinks",
      "parent_id": null
    },
    {
      "id": "3a1e3be5-6e40-4bb1-a775-07d6811d5143",
      "name_en": "Coffee",
      "parent_id": "c3993d7e-48f7-467a-9f91-6be206295f68"
    }
  ],
  "product": {
    "id": "a743e3c2-2838-4476-b4a4-5d920e4177ba",
    "category_id": "3a1e3be5-6e40-4bb1-a775-07d6811d5143",
    "name_en": "Iced coffee",
    "price": 2.75,
    "is_available": true
  }
}
```

Omit `categories` or send `[]` when the required categories already exist for
the business. Supplied category rows use the same insert and patch rules as
catalog sync. For an existing product, send its `id` and any changed fields. To
hide it, send `is_available: false`. For exact retry deduplication, include a
stable UUID in `sync_id` on the first delivery and resend the identical body.
Retry `SYNC_CONFLICT` with backoff. An optional `source_updated_at` is checked
against the last supplied source timestamp for that product, including timestamped
catalog imports. A stale event for that product returns `409 STALE_SYNC`.
Deliveries without a source timestamp apply in receipt order. Concurrent writes
can require a retry.

A successful write or exact retry returns HTTP 200 with only this message.

```json
{
  "message": "POS product synced successfully."
}
```

### Optional POS menu trees

The full catalog endpoint accepts `menus` and `menu_products` together as a
snapshot of the business’s POS-owned menu trees and product assignments. Use
stable POS UUIDs for menu IDs and an explicit `source_updated_at`. Categories
continue to describe the reporting catalog. Example menu-only snapshot for a
product already synced to eMenu

```json
{
  "source_updated_at": "2026-11-09T08:00:00Z",
  "categories": [],
  "products": [],
  "menus": [
    {
      "id": "40000000-0000-4000-8000-000000000001",
      "slug": "terrace",
      "name_km": "រានហាល",
      "name_en": "Terrace",
      "name_zh": "露台",
      "sort_order": 0
    },
    {
      "id": "40000000-0000-4000-8000-000000000002",
      "parent_id": "40000000-0000-4000-8000-000000000001",
      "name_en": "Drinks",
      "name_zh": "饮品",
      "sort_order": 1
    }
  ],
  "menu_products": [
    {
      "menu_id": "40000000-0000-4000-8000-000000000002",
      "product_id": "20000000-0000-4000-8000-000000000001"
    }
  ]
}
```

Each node can include `parent_id`, `slug`, `name_km`, `name_en`, `name_zh`,
`sort_order`, `is_active`, and either `image_url` or a tenant-owned
`image_media_id`. Supply at least one name for a new node. Include the parent
of each submenu in the snapshot. Slugs stay fixed after creation so QR links
can continue using them. An omitted slug is generated on first import.

When both arrays are omitted, the endpoint keeps all menu data. When both are
empty, it archives POS trees and clears their assignments. Local menus and
assignments are managed in Control. A QR link can select a root using
`?menu=terrace`, with an optional branch such as `?branch=riverside&menu=terrace`.
Assign products to submenus in both `menu_products` and `product.menu_ids`.
The root identifies the QR menu, and guests browse its submenus.

To change one product’s POS assignments, send this body to the single-product
endpoint. Omit `menu_ids` to keep the assignments or send `[]` to clear them.
Reuse the same `sync_id` and body for a retry. A full snapshot must be newer
than the last menu-bearing write, and a product update must be newer than the
last menu snapshot and that product’s previous menu update.

```json
{
  "source_updated_at": "2026-11-09T08:15:00Z",
  "product": {
    "id": "20000000-0000-4000-8000-000000000001",
    "menu_ids": ["40000000-0000-4000-8000-000000000002"]
  }
}
```

### Table and table group sync

A table group can include the eMenu `branch_id` from **Super Control →
Business Detail → Branches**. Omitting it keeps the branch on an existing group
and assigns a new group to the default branch. Tables inherit the group’s
branch. Table codes and group names are unique within each branch.

Send `POST /api/integrations/pos/sync/tables` with `Content-Type: application/json`
and the same `Authorization: Bearer pos_...` header. The API resolves the business
from the key. The `table_groups` and `tables` arrays are required and can contain
up to 500 groups and 1,000 tables. Use `[]` for the unused array.

```json
{
  "table_groups": [
    {
      "id": "390471a1-580a-44ef-a902-a343ec804a57",
      "name": "Main dining room",
      "sort_order": 0,
      "is_active": true
    }
  ],
  "tables": [
    {
      "id": "b6457a20-0c18-487b-b40f-171fa4bd1a89",
      "group_id": "390471a1-580a-44ef-a902-a343ec804a57",
      "code": "T01",
      "label": "Table T01",
      "sort_order": 1,
      "is_active": true
    }
  ]
}
```

In Frappe, use `Table Group.table_group_name_en` for the group `name` and
`Tables Number.tbl_number` for the table `code`. Send the table number as a
string to preserve leading zeros. Resolve `Tables Number.tbl_group` to the
group's sync `id`. Map `disabled` to `is_active` by inverting the flag.

Generate and persist a UUID per new POS record. To sync into a table or group
already created in eMenu, map the POS record to its existing eMenu `id`.
Group names and table codes are unique within each branch, regardless of case. Group
names and labels are limited to 80 characters and table codes to 30.
New tables need `group_id` and `code`, and their `label` defaults to `code`.
Existing records keep omitted fields. A group must be active for its active
tables. To archive a group, move or archive all its active tables, which can be
done in the same request.

The API saves groups and tables in one transaction and generates a QR token for
each new table. Existing QR tokens are preserved. Use a stable optional `sync_id`
UUID and resend the identical body for exact retry deduplication. A successful
request returns HTTP 200 and `{"message":"POS tables synced successfully."}`.

If table codes conflict within a branch, eMenu skips the conflicting rows and
saves the valid records. An existing table keeping its code takes priority.
For multiple new rows claiming the same available code, the first wins.
The HTTP 200 response includes a `warnings` array with one
`DUPLICATE_TABLE_CODE` warning per skipped row. Each warning includes
`table_id`, `table_code`, and a human-readable `message`. Exact retries
with the same `sync_id` return the same warnings.

When a table is deleted in the POS, post a separate archive request to the same
endpoint. Use the original sync UUID as `table_id`.

```json
{
  "archive": { "table_id": "b6457a20-0c18-487b-b40f-171fa4bd1a89" }
}
```

For a deleted group, use `archive.table_group_id`. eMenu marks that group and
its remaining tables inactive in one transaction. The records, QR tokens, and
order history are retained. An ID with no matching record in the business is a
no-op. A stable `sync_id` can deduplicate archive retries.

## 4. Category fields: complete D1 mapping

Use **snake_case** for supported sync keys at every level, including the
envelope and nested records. Examples include `sync_id`, `source_updated_at`,
`name_km`, `price`, `modifier_groups` and `price_list_id`. eMenu ignores
unrecognized keys such as a POS-only `product_code` on a portion. A camelCase
alias is treated as an extra key, so send the supported name for every required
field.

| JSON field       | D1 column        | Behavior                                                                                                                                                                                                           |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | `id`             | Required POS UUID. Immutable identifier.                                                                                                                                                                           |
| —                | `business_id`    | Set by the API from the POS key. Not writable.                                                                                                                                                                     |
| `parent_id`      | `parent_id`      | Category ID or `null` for a root. New records default to `null`. Existing legacy eMenu category IDs can also be referenced.                                                                                        |
| `name`           | `name`           | Primary source name, up to 300 characters.                                                                                                                                                                         |
| `name_km`        | `name_km`        | Khmer display name, up to 300 characters; missing/empty falls back to `name`.                                                                                                                                      |
| `name_en`        | `name_en`        | Optional English name, up to 300 characters; `null`/`""` clears.                                                                                                                                                   |
| `name_zh`        | `name_zh`        | Optional Chinese name, up to 300 characters; `null`/`""` clears.                                                                                                                                                   |
| `slug`           | `slug`           | Optional unique slug within the business, up to 200 lowercase ASCII letters/digits separated by hyphens. Omitted/null/blank: generated for new records; preserved on updates. A nonempty value sets it explicitly. |
| `image_url`      | `image_url`      | Image URL or relative POS path, up to 2,048 characters; `null`/`""` clears. Sets an external image and clears the media link.                                                                                      |
| `image_media_id` | `image_media_id` | Existing eMenu media ID owned by this business. Derives `image_url` from the media. `null`/`""` clears the media link and image. Send this **or** `image_url`.                                                     |
| `sort_order`     | `sort_order`     | Integer 0–999,999; default 0.                                                                                                                                                                                      |
| `is_active`      | `is_active`      | Boolean or 0/1; default true.                                                                                                                                                                                      |
| `created_at`     | `created_at`     | Optional ISO timestamp used **only on insertion**; otherwise server time. Original creation time is preserved on updates.                                                                                          |

A new category needs a nonempty name. If `name`/`name_km` is missing, a supplied
English or Chinese name can be used as the primary fallback. Text is trimmed.
The category table has no `updated_at` column.

For both categories and products, negative `sort_order` values are stored as **0**.
Values above 999,999, positive fractional numbers, and non-numeric values are
stored as **999,999**. Valid integers from 0 to 999,999 are preserved. If omitted,
new records default to 0 and existing records keep their current order.

## 5. Product fields: complete D1 mapping

| JSON field         | D1 column              | Behavior                                                                                                                                                                          |
| ------------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `id`                   | Required POS UUID.                                                                                                                                                                |
| —                  | `business_id`          | Set by the API from the POS key. Not writable.                                                                                                                                    |
| `category_id`      | `category_id`          | Required for new products; category must belong to this business or appear in this request.                                                                                       |
| `code`             | `code`                 | Optional POS code/SKU, up to 64 characters. Unique within the business, case-insensitively. `null`/`""` clears.                                                                   |
| `name`             | `name`                 | Source name, up to 300 characters. Same new-record fallback rules as categories.                                                                                                  |
| `name_km`          | `name_km`              | Khmer display name, up to 300 characters; falls back to source name.                                                                                                              |
| `name_en`          | `name_en`              | English name, up to 300 characters; `null`/`""` clears.                                                                                                                           |
| `name_zh`          | `name_zh`              | Chinese name, up to 300 characters; `null`/`""` clears.                                                                                                                           |
| `slug`             | `slug`                 | Same rules as category slugs; unique among this business's products.                                                                                                              |
| `description`      | `description`          | String up to 20,000 characters; default `""`. Use `""` to clear.                                                                                                                  |
| `price`            | `price_cents`          | Required for new products without portions. Actual currency amount. With portions, the stored value is the minimum portion price.                                                 |
| `max_price`        | `max_price`            | Derived from the maximum portion price, or `price` without portions. Optional input is checked against that value.                                                                |
| `unit`             | `unit`                 | String up to 40 characters, e.g. `"cup"`; default `""`.                                                                                                                           |
| `portions`         | `portions_json`        | Array described below; default `[]`. Replaces the whole array when supplied.                                                                                                      |
| `modifier_groups`  | `modifier_groups_json` | Array described below; default `[]`. Replaces the whole array when supplied.                                                                                                      |
| `image_url`        | `image_url`            | Primary image URL or relative POS path, up to 2,048 characters. Clears `primary_media_id`; also clears the gallery unless `media_ids` is supplied explicitly. `null`/`""` clears. |
| `primary_media_id` | `primary_media_id`     | Existing media owned by this business; derives the image URL and includes it in the gallery. Send this or `image_url`. `null`/`""` clears the primary link and URL.               |
| `calories`         | `calories`             | Integer 0–1,000,000 or `null`; default `null`.                                                                                                                                    |
| `prep_minutes`     | `prep_minutes`         | Integer 0–999,999 or `null`; default `null`.                                                                                                                                      |
| `rating`           | `rating`               | Number 0–5 or `null`; default `null`. This is the displayed product rating, not a customer review import.                                                                         |
| `is_featured`      | `is_featured`          | Boolean or 0/1; default false.                                                                                                                                                    |
| `is_available`     | `is_available`         | Boolean or 0/1; default true.                                                                                                                                                     |
| `sort_order`       | `sort_order`           | Integer 0–999,999; default 0.                                                                                                                                                     |
| `created_at`       | `created_at`           | Optional ISO timestamp on insertion; defaults to server time. Preserved on updates.                                                                                               |
| —                  | `updated_at`           | Server-managed timestamp on insert/update. Do not send `updated_at`.                                                                                                              |

### Portions and modifiers

```json
{
  "unit": "cup",
  "portions": [
    {
      "label_km": "តូច",
      "label_en": "Small",
      "label_zh": "小",
      "price": 2.5,
      "branch_id": null,
      "price_rule": "fixed",
      "unit": "cup"
    },
    {
      "label_km": "ធំ",
      "label_en": "Large",
      "price": 3.5,
      "branch_id": "br_riverside",
      "price_rule": "fixed",
      "unit": "cup"
    }
  ],
  "modifier_groups": [
    {
      "label_km": "ទឹកដោះគោ",
      "label_en": "Milk",
      "required": true,
      "multiple": false,
      "options": [
        {
          "label_km": "ធម្មតា",
          "label_en": "Regular",
          "price": 0,
          "prefix": "+"
        },
        {
          "label_km": "Oat",
          "label_en": "Oat",
          "price": 0.5,
          "prefix": "+"
        }
      ]
    }
  ]
}
```

- Up to 20 portions, 12 modifier groups, and 1–30 options per group.
- Omit `id` on portions, modifier groups and options to have eMenu assign
  fresh UUIDs on each applied sync. Existing callers can still supply stable
  IDs for POS order mapping or portion price overrides. Supplied IDs use
  letters, digits, hyphens or underscores (1–80 characters) and must be
  unique within each array. The ID `base` is reserved.
- `label_km` is required and nonempty; translated labels are optional strings.
  Labels are limited to 120 characters. A connector can use its source label as
  the fallback when it has no translated label.
- Portion prices are required. Modifier option prices can be omitted or `null`
  for no price adjustment. `required`/`multiple` default to false and accept
  booleans or 0/1.
- Both product sync endpoints accept optional `branch_id` on each portion.
  Omit it or send `null` to offer the portion at every branch. To offer it at
  one branch, send that branch's eMenu ID from Super Control. Replace the
  example ID `br_riverside` with the actual ID. eMenu rejects IDs from other
  businesses. A product with portions appears only where at least one of them
  is available.
- Portions also accept optional `price_rule` (text, up to 120 characters) and
  `unit` (text, up to 40 characters). Both default to `""` when omitted.
- Modifier-group options accept optional `prefix` (text, up to 40 characters),
  defaulting to `""`. For example, `"+"` can be kept as POS metadata.
- These extra text fields are stored in the existing `portions_json` and
  `modifier_groups_json` data and preserved through dashboard edits. They do not
  evaluate a pricing formula or change how prices are calculated.
- The serialized portions and modifiers together are limited to 64,000 characters.
- Each supplied `portions` or `modifier_groups` array replaces the entire
  collection on that product, including the options in the supplied groups.
  Send `[]` to clear a collection or omit the field to keep it. Replaced
  portion IDs lose their associated price-list entries. Normal Rate is written
  for the new portions.

### Gallery: `product_images`

The additional product field `media_ids` is an ordered array of up to 5 distinct,
already-uploaded eMenu media IDs owned by the same business. Each maps to
`product_images.media_id`; the product UUID maps to `product_id`. `business_id`
comes from the key, `sort_order` comes from array position, `is_primary` comes
from `primary_media_id`, and `created_at` is server-managed.

When `media_ids` is supplied without a primary image field, the existing primary
is kept if present in the array; otherwise the first media ID becomes primary.
An explicitly supplied primary media ID is included in the gallery. The final
gallery must still contain at most 5 IDs. To clear all photos, send:

```json
{
  "image_url": null,
  "primary_media_id": null,
  "media_ids": []
}
```

POS image URLs and relative paths can be supplied through `image_url`. The API
stores the trimmed text without checking its URL format or adding a host name.
Relative paths such as `/files/coffee.webp` are accepted.

Category and product image values longer than 2,048 characters after trimming
are stored as `null` instead of rejecting the sync; other fields and records
continue syncing. Exactly 2,048 characters are accepted. Non-string values other
than `null` remain invalid.

For images on a separate Frappe host to display in the public menu, use a full publicly accessible image
URL. The sync endpoint does not download images or create R2/media records.
Existing R2 media can be uploaded through
the dashboard or `/api/admin/media` with an authorized admin session, then
referenced by ID. Remote URL galleries are not supported by the current D1
`product_images` schema; use the external primary image or uploaded eMenu media.

### Price lists: `product_prices`

Each product's base price or portion prices automatically update its business's
existing **Normal Rate** price list. Updating only `products.price_cents` would
leave displayed menu prices stale, so the endpoint updates both together.

Optional `price_entries` set or clear overrides in other existing, non-archived
price lists belonging to the business:

```json
{
  "price_entries": [
    {
      "price_list_id": "prl_existing_special_rate",
      "target_key": "base",
      "price_cents": 2.25
    },
    {
      "price_list_id": "prl_existing_other_rate",
      "target_key": "base",
      "price_cents": null
    }
  ]
}
```

| Field              | D1 mapping / rule                                                            |
| ------------------ | ---------------------------------------------------------------------------- |
| Product `id`       | `product_prices.product_id`                                                  |
| API key's business | `product_prices.business_id`                                                 |
| `price_list_id`    | `price_list_id`; must already exist in this business and not be archived     |
| `target_key`       | `target_key`; `base` without portions, or a current portion ID with portions |
| `price_cents`      | `price_amount`; actual currency amount; `null` removes this override         |
| —                  | `created_at` / `updated_at` are server-managed                               |

When creating or replacing portions and supplying overrides in the same request,
include stable portion IDs and use those IDs in `target_key`.

Up to 200 overrides per product. Omitted entries stay unchanged, except entries
for removed price targets are deleted. Do not send Normal Rate in `price_entries`;
use `price`/`portions`. Sync does not create price-list definitions or alter
their schedules. Fetch existing IDs using `/api/admin/price-lists` as an admin.

## 6. Example you can run locally

The full example file is [examples/pos-sync.json](examples/pos-sync.json).
For a comprehensive category/product payload with portions, modifier groups and
options, see [examples/pos-sync-full.json](examples/pos-sync-full.json). Replace
its sample POS UUIDs and image URLs. It leaves slugs blank for automatic handling,
omits optional `created_at` timestamps, and uses `price_entries: []` for standard
pricing. Add promotional overrides using the format above when needed.
`created_at` is set by eMenu for new records and preserved for existing records
when omitted. Both files send only `categories` and
`products` at the top level. The example prices assume a USD business; adjust all
amounts to the currency configured on the target business.

After obtaining a POS key, run from the project root in PowerShell:

```powershell
$apiBase = 'http://localhost:8787'
$posKey = Read-Host 'Paste the POS API key'
$catalog = Get-Content -LiteralPath docs/examples/pos-sync.json -Raw -Encoding UTF8 | ConvertFrom-Json
# The example assumes a USD business. For a KHR business, use KHR price amounts.
$json = $catalog | ConvertTo-Json -Depth 30
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod -Method Post -Uri "$apiBase/api/integrations/pos/sync" `
  -Headers @{ Authorization = "Bearer $posKey" } `
  -ContentType 'application/json; charset=utf-8' -Body $bodyBytes
```

For a USD business, `price: 2.5` means USD 2.50. For a KHR business, a price of
10,000 KHR is sent as `price: 10000`; do not send a currency override.
The file contains fixed sample UUIDs: replace them with actual POS UUIDs when
connecting a real restaurant. Submitting the example creates or updates those
records; it is not a dry run.

With a prepared UTF-8 JSON file, a POS can also use cURL:

```sh
curl --fail-with-body \
  --request POST 'http://localhost:8787/api/integrations/pos/sync' \
  --header "Authorization: Bearer $EMENU_POS_API_KEY" \
  --header 'Content-Type: application/json' \
  --data-binary @catalog-sync.json
```

In POS server code, the final request can be:

```javascript
// These arrays have already been fetched from ALL pages of the POS's two APIs
// and mapped to the documented eMenu fields. Keep each original POS UUID as id.
const requestBody = JSON.stringify({
  categories: mappedCategories,
  products: mappedProducts,
});

const result = await fetch(
  `${process.env.EMENU_API_BASE}/api/integrations/pos/sync`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.EMENU_POS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: requestBody,
  },
);
const message = await result.json();
if (!result.ok) throw new Error(`${result.status}: ${message.error}`);
console.log(message.message);
// On a network error or retryable 5xx, retry with backoff. Stable POS UUIDs
// update existing records. Add an optional sync_id for exact deduplication.
```

## 7. Errors, retries and consistency

Validation errors have a short response such as:

```json
{
  "error": "products[0].price: must be a number between 0 and 1000000000000",
  "code": "INVALID_SYNC_DATA"
}
```

| Status | Meaning / action                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200`  | Entire catalog request committed, or exact successful retry.                                                                                                                            |
| `400`  | Invalid JSON, missing required fields, wrong types, duplicate IDs, invalid parent/category/media/price-list references, optional currency-hint mismatch, or a category cycle. Correct the input. |
| `401`  | Missing/invalid/rotated/revoked POS key or disabled business. Check connection settings.                                                                                                |
| `402`  | Business subscription expired; writes are blocked.                                                                                                                                      |
| `403`  | Owner access is required for key management.                                                                                                                                            |
| `405`  | Wrong method. Catalog sync accepts only POST.                                                                                                                                           |
| `409`  | Conflicting UUID/code/slug, missing Normal Rate, reused sync_id with different body, stale timestamp, or concurrent catalog/key changes. Check `code`.                                  |
| `413`  | Body exceeds 8 MiB (key management body limit: 4 KiB).                                                                                                                                  |
| `415`  | Content-Type is not application/json.                                                                                                                                                   |
| `500`  | Unexpected error; includes `requestId` for server logs. Retry the original body with backoff.                                                                                           |

Important `409` codes:

- `SYNC_ID_REUSED`: this UUID was already committed with different request bytes.
  Use the original body for a retry. For a new catalog, omit this optional field
  or provide a new sync_id; update source_updated_at too if you supply one.
- `STALE_SYNC`: the supplied `source_updated_at` is at or before a stored source
  timestamp for an included product, or a catalog request is at or before the
  last catalog sync. Fetch the current POS data before preparing a new request.
- `CATALOG_ID_CONFLICT`: an incoming category/product UUID belongs to a different
  business. Check the business connection and POS ID scope.
- `CATALOG_VALUE_CONFLICT`: duplicate product code or slug in the final catalog.
- `SYNC_CONFLICT`: catalog references, a concurrent sync, or key rotation changed
  the validated snapshot. Retry with backoff; if the conflict persists, refresh
  the catalog and check identifiers.

The API validates before writing, then commits categories, products, galleries,
price changes, the retry marker, and the menu cache version in **one atomic D1
transaction**. A database failure rolls everything back. It never returns success
for a partial import. Concurrent duplicate retries with the same explicit sync_id
commit once. Replaying an older successful request with that same ID and body
returns success without overwriting a newer catalog. Requests without sync_id
are separate upserts, not deduplicated replays. Concurrent distinct requests can
return SYNC_CONFLICT; retry after the in-flight sync completes.

The existing public menu uses a versioned cache key. A successful sync increments
that version once, so subsequent menu loads use the updated catalog. An already
open menu page needs to be refreshed; this endpoint does not push live updates
into customers' browsers.

Key rotation preserves sync history. Disconnecting the integration deletes its
key and retry history, while keeping categories/products/prices. After reconnecting,
prepare a fresh snapshot. Optional client-supplied metadata should be regenerated
instead of replaying old requests.

## 8. Verification

```powershell
npm run typecheck
npm run test:pos-sync
```

The integration tests compile the actual API Worker and run every SQL migration
in an isolated, in-memory local D1 runtime. They cover a 300-product import, all
catalog fields, pricing and photos, retries/concurrency, UUID compatibility with
existing admin routes, cross-business access rejection, key rotation/revocation,
subscription checks and transaction rollback. They do not use the restaurant's
local or production database.
