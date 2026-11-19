# eMenu POS API v1

Use this API to connect a register to eMenu. The register selects a POS profile, reads the eligible catalog, saves open bills, and records completed payments. The profile determines which branch, tables, and operating controls the register uses. Register apps render and print receipts and handle payment processing.

The [OpenAPI 3.1 contract](pos-api.openapi.json) defines the complete request and response shapes. The [catalog sync](pos-catalog-sync.md) and [online order](pos-online-orders.md) integrations use their existing endpoints and credentials.

## Set up a profile

For local development, run `npm run db:migrate:local` and `npm run dev:api` from the repository root. The local API is `http://localhost:8787`. Use the HTTPS Worker origin supplied by the business for other environments.

Use an existing eMenu Control owner or manager session for setup. Send its bearer token to `/api/admin/pos`.

| Method and path                                          | Purpose                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /profiles`, `GET /profiles/{id}`                    | Read profile settings and any queued configuration                    |
| `POST /profiles`, `PATCH /profiles/{id}`                 | Create, update, or deactivate a profile                               |
| `GET /profiles/{id}/grants`, `PUT /profiles/{id}/grants` | Read or replace explicit staff grants with `{"user_ids":["user-id"]}` |
| `GET /payment-types`, `POST /payment-types`              | List or create business payment types                                 |
| `GET /payment-types/{id}`, `PATCH /payment-types/{id}`   | Read a payment type or rename it                                      |
| `GET /customers`, `POST /customers`                      | List or create customers by name and optional `external_reference`    |
| `GET /customers/{id}`, `PATCH /customers/{id}`           | Read or edit a customer                                               |

Create payment types first, for example `{"name":"Cash USD","kind":"cash","currency":"USD"}` and `{"name":"Cash Riel","kind":"cash","currency":"KHR"}`. Use their returned IDs in the profile. Valid kinds are `cash`, `card`, `qr`, and `other`. Each profile entry requires a single `currency` of `USD` or `KHR`. If the payment type has its own currency, the profile must use that currency. Use two payment types to accept both currencies. For existing entries that accepted both, the migration uses the business's primary currency.

```json
{
  "name": "Patio register",
  "branch_id": "replace-with-branch-id",
  "config": {
    "working_day_enabled": true,
    "cashier_shift_enabled": true,
    "table_mode": "optional",
    "table_group_ids": null,
    "catalog_mode": "category",
    "selected_ids": null,
    "default_menu_id": null,
    "payment_types": [
      { "id": "replace-with-cash-usd-id", "currency": "USD" },
      { "id": "replace-with-cash-khr-id", "currency": "KHR" }
    ],
    "default_payment_type_id": "replace-with-cash-usd-id",
    "default_customer_id": null,
    "receipt_template": {
      "title": "Patio",
      "footer": "Thank you",
      "show_tax": true
    },
    "print_copies": 2,
    "tax_mode": "inclusive",
    "tax_rate_bps": 1000
  }
}
```

Omitting or clearing the default customer selects the business’s walk-in record. The default payment type is a preselection for the register. Every checkout entry specifies its payment type and currency. The profile must use the assigned currency for fixed-currency methods. Enable at least one payment type in the business currency and at most one cash type per currency.

Table modes are `disabled`, `optional`, and `required`. Set `table_group_ids` to distinct active group IDs from the profile’s branch in display order. Null or omitted uses all active groups in branch order. Set `prompt_guest_cover` to prompt the operator for guest count. The `table_status_colors` object accepts six-digit hex colors for `vacant`, `occupied`, `bill_requested`, `hold`, and `booked`. The profile API supplies defaults for omitted colors.

A table sale can save `guest_cover` as an integer from 1 to 1,000. Removing the table clears the count. A confirmed Control booking with an assigned table appears as `booked` from 30 minutes before arrival through two hours after arrival. Table responses include the reservation arrival and party size during that window. An open sale takes priority over a booking. The Flutter register shares held orders and bill requests through the designated store register.

Use `catalog_mode: "menu"` with menu IDs or `"category"` with category IDs. A null or omitted `selected_ids` includes all active roots and their descendants. An explicit list includes the selected active nodes and descendants. For menu profiles, set `default_menu_id` to an active top-level menu explicitly listed in `selected_ids`, or `null` for no default. Product availability, branch portions, menu assignments, and price lists come from eMenu’s existing catalog.

Send `config.tax_rules` as an array of named rules. Each rule has three tax levels with percent rates from 0 through 100, discount switches, and switches to include earlier levels in its base. A rate of zero leaves the level inactive for clients that apply the rule. Each rule sets its own `tax_mode` to `disabled`, `inclusive`, or `exclusive`. Rules submitted without `id` receive one from the API. Reuse it when editing that rule.

The setup API and `GET /context` return the array in `config.tax_rules`. Send an empty array to clear the rules.

Save `config.default_tax_rule_id` with the ID of a rule in this profile, or `null` to clear the selection. Profile responses include that ID and the full selected rule as `config.default_tax_rule`. Removing the selected rule clears the default. An omitted array on a profile update retains the saved rules. Registers use the latest saved tax settings while editing a bill, including when the profile has a pending update. Bill writes with lines recalculate with the same rule. Paid sales retain their recorded tax amounts.

Save print layouts in `config.receipt_templates`. Each template has a stable ID and a type of `receipt`, `kitchen_receipt`, or `qr_label`. Templates include the language, paper width, copy count, title, footer, text size, heading alignment, and a list of fields to print. QR labels also include the label height, QR size, menu or custom URL target, and caption.

Set `config.default_receipt_templates` with the template ID for each type. The IDs must belong to matching templates in the profile. Send `null` for a default to clear it. Removing a template clears its default. `GET /context` returns the template list and defaults. Current POS checkout uses the profile’s `receipt_template` and `print_copies` values.

A profile belongs to one branch. A `PATCH` with `config` replaces the full configuration. The API returns `pending_config` while a shift or unpaid bill is open, and promotes it after the last such activity closes. The register uses the latest saved tax settings during bill edits. For a profile already using menus, newly selected menus and a valid default menu take effect in `GET /context`, the catalog, and sale pricing while the update is pending. Menu removals and catalog mode changes take effect when the pending profile is promoted. An owner or manager can deactivate an idle profile. Paid bills keep the receipt and amounts captured with them.

## Sign in and start a register

All routes in this section and below use `/api/integrations/pos/v1`.

1. Send `POST /auth/login` with `business_slug`, `email`, `auth_version`, and `password_proof`. The discovery token is valid for 15 minutes.
2. Send `GET /profiles` with the discovery token. Owners and managers can select active profiles in their business. Other staff need a profile grant.
3. Send `POST /sessions` with the discovery token and `{"profile_id":"..."}`. Use the returned profile token for register requests. It expires after 12 hours.
4. Call `GET /context` to read the selected profile, effective settings, operator, business currency, local date, current working day, and current shift. Read copy counts from `profile.config.receipt_templates` and tax modes from `profile.config.tax_rules`. Call `DELETE /sessions/current` to revoke the bearer token used for that request.

`GET /context` returns one entry per payment type and currency in `profile.config.payment_types`. The `payment_type` field is the configured name. The `allow_cash_float` flag is always a boolean. A payment type that accepts USD and KHR appears twice with the same ID. The response follows the order saved in the profile.

```json
[
  { "id": "cash-usd-id", "payment_type": "Cash USD", "currency": "USD", "allow_cash_float": true },
  { "id": "cash-khr-id", "payment_type": "Cash KHR", "currency": "KHR", "allow_cash_float": true },
  { "id": "qr-id", "payment_type": "ABA QR", "currency": "USD", "allow_cash_float": false }
]
```

Both tokens use `Authorization: Bearer <token>`. Send the exact auth version `client-pbkdf2-sha256-v1`. Derive the password proof with PBKDF2-HMAC-SHA256, 120,000 iterations, and a 32-byte output encoded as lowercase hexadecimal. The UTF-8 salt is `angkor-emenu:client-pbkdf2-sha256-v1:<normalized-email>`, with the email trimmed and lowercased. The [Node smoke example](examples/pos-api-smoke.mjs) includes the derivation. Treat the proof and both tokens as credentials and keep them out of logs.

Browser deployments can set `POS_ALLOWED_ORIGINS` on the Worker to a comma-separated list of exact app origins. Native and server clients can use the bearer API directly. Profile grants and membership are checked on every operating request, including requests made with an already-issued token.

### Staff username sign-in

When `GET /context` reports `capabilities.staff_usernames`, an owner or manager can list eligible staff with `GET /staff` using their profile token. Use `PUT /staff/{user_id}/username` with an `Idempotency-Key` and `{"username":"front-till"}` to assign a username. Send `{"username":null}` to remove it. Usernames are business-wide and case-insensitive. Use 2–40 ASCII letters, digits, dots, hyphens or underscores, starting with a letter or digit. A duplicate returns `409 POS_USERNAME_TAKEN`.

On a register activated by the owner, use a saved owner or manager profile token to send `POST /auth/resolve-username` with `{"username":"front-till"}`. This resolves the staff account email for the active profile. An unknown username or missing profile grant returns `404`. Derive the proof on the device from the returned email and staff password. Send the email, username, and proof to `POST /auth/login`, then start a session and enroll the staff PIN. The PIN is local to the till.

### Renew an enrolled device

When `GET /context` reports `capabilities.device_sessions`, an installed register can renew its operator session without keeping the password.

1. Generate an Ed25519 key pair for the installation and protect the private key in the OS credential store. Call `POST /devices` using the profile bearer from a password sign-in. Send a stable `device_id`, a `device_name`, and the 32 raw public key bytes as lowercase hexadecimal in `public_key`. Save the returned `id` for this operator and profile.
2. To renew, generate a fresh random 32-byte nonce and encode it as lowercase hexadecimal. Set `issued_at` to the current Unix time in seconds. Sign these four lines as UTF-8 with LF separators and no trailing newline.

   ```text
   emenu.pos.device-session.v1
   <credential_id>
   <issued_at>
   <nonce>
   ```

3. Call `POST /auth/device-session` with `credential_id`, `issued_at`, `nonce`, and the 64-byte `signature` in lowercase hexadecimal. The Worker issues a 12-hour profile bearer for the enrolled operator. If the renewal response is lost, sign a fresh proof. The signed request is accepted once and has a two-minute clock tolerance.

Use `GET /devices` to list credential IDs. Owners and managers can revoke any credential for the selected profile with `DELETE /devices/{credential_id}`. Other staff can revoke their own. Revocation invalidates bound tokens, and removing a staff profile grant also revokes that staff member's credentials for the profile. Renewed tokens cannot enroll new keys. After access is restored, enroll again with a password sign-in.

A `409 DEVICE_PROOF_EXPIRED` response means the register clock differs from Worker time. Correct the clock before signing again. A `403 PASSWORD_SESSION_REQUIRED` response means key enrollment needs a profile token from a password sign-in.

## Assign a store register for offline operations

When `capabilities.store_operations` is available, an owner can assign a branch to an enrolled device with `POST /store-authority` and an empty JSON object. The branch needs to have closed days and shifts and resolved unpaid bills. The response gives an `epoch`, `timezone`, and `last_sequence`. Retry a lost claim response on the same device. `GET /store-authority` returns the branch’s assignment and whether the signed-in device holds it.

While assigned, the branch accepts operating writes through `POST /store-operations` from the designated device. Existing profile reads and committed idempotent replies remain available. Enroll the same installation key and `device_id` for each operator and profile used by the store register. Upload each event with the device session for the profile and operator that recorded it. Events for different profiles share the same sequence. The working day belongs to the branch. Shifts, sales and drawer counts belong to their respective profiles.

Save the event and its local business operation in one transaction. Send events in sequence starting at 1. Use a stable `Idempotency-Key` per event, an original UTC `occurred_at` timestamp, and the flags `working_day_enabled` and `cashier_shift_enabled` under `settings`. Each event includes its `epoch`, `sequence`, `kind`, `resource_id`, and `payload`. Include `profile_id` on new events so the Worker can reject an upload using a different profile session. Existing journal entries can replay with their original payload.

| Kind | Resource ID | Payload |
| --- | --- | --- |
| `open_day` | Local working day ID | Empty object |
| `close_day` | Working day ID | Empty object |
| `open_shift` | Local shift ID | `opening_cash` and the saved `payment_types` |
| `cash_movement` | Local cash movement ID | Cash movement fields and `shift_id` |
| `close_shift` | Shift ID | `activity_revision` and counts with `expected_minor` and `declared_minor` |
| `checkout` | Local sale ID | Saved operating context, priced lines, payment types, tenders, customer, table, tax and receipt snapshots |
| `submit_sale` | Local sale ID | Saved operating context, priced lines, customer, table, tax and receipt snapshots |
| `cancel_sale` | Submitted sale ID | Cancellation reason |
| `reversal` | Local reversal sale ID | `original_sale_id`, `reason`, `expected_context`, and the original `expected_total_minor` |

The server validates the device, event sequence, operating context, sale arithmetic, and reconciliation. It records the operation and advances the sequence in the same transaction. A checkout import creates or settles the sale and adds its payment rows together. Replaying an identical event returns its saved reply. `STORE_SEQUENCE_CHANGED` means an earlier event is missing or an event ID differs from the recorded one. Retain the journal and resolve the first rejected event before advancing.

When `capabilities.store_recovery` is available, the owner can approve a queued entry after the original operator loses device or profile access. Call `POST /store-operations/recover` with the owner's device session on the designated register. Use the original `Idempotency-Key` and send `profile_id`, `operator_id`, `reason`, and `operation`, which is the complete original envelope. The approving session can use any active profile in the same branch. The Worker checks the register's enrolled public key and the original operator's enrollment history. If the operator can still sync, it returns `409 STORE_OPERATOR_ACTIVE`. If no enrollment record is available, it returns `409 STORE_OPERATOR_UNKNOWN`.

The original operator, receipt, and operating time stay with the entry. The server records who approved it and why in the same transaction as the operation and sequence advance. If the entry was already committed, recovery returns its saved acknowledgment. Owners and managers can page through new approvals with `GET /store-operations/recoveries` for the selected branch.

To release an assignment, close operating activity and drain the register’s journal. On the designated device, call `DELETE /store-authority` with the original `epoch` and acknowledged `last_sequence`. The owner of the replacement register can then claim the idle branch.

## Run a register

1. If the profile uses working days, a manager opens one with `POST /working-days` and an empty JSON object. Each branch shares one open day across its profiles. The API captures its business date and time zone at opening. For example, a day opened on November 12 in Phnom Penh keeps November 12 for sales completed after local midnight, until the manager closes it. Profiles with working days disabled use the local date at checkout.
2. If the profile uses cashier shifts, open one with `POST /cashier-shifts`. Supply optional `opening_cash` entries with `payment_type_id`, `currency`, and `amount_minor` for methods that allow cash floats. Omitted opening balances start at zero. Each profile has one open shift at a time.
3. Load `GET /catalog`, `GET /tables`, and `GET /customers`. The table list shows the open sale ID for this profile, if any. Another profile can have its own bill at the same physical table. Use `page` and `page_size` on paginated routes and follow `has_more`. The catalog page size applies to products. Each page includes the eligible menu or category hierarchy.

For a menu-based profile, send `GET /catalog?menu_id=<menu-or-submenu-id>&page=1&page_size=100` to read one menu and all of its descendants. `nodes` includes the chosen menu with `parent_id: null` and its subtree on each page. `products` includes products assigned anywhere under that menu, including directly to it, and `menu_ids` contains only assignments within that subtree. Omit `menu_id` to load the full profile catalog, or use `profile.config.default_menu_id` from `GET /context` to open the default menu. A menu outside the active profile scope returns `404`. Category-based profiles return `400` if you pass `menu_id`.

Each catalog product includes the boolean fields `allow_discount`, `allow_change_price`, `is_open_product`, and `allow_free`. Configure them in the product editor's **POS Option** tab. Discount, price changes, and free items default to enabled. Open product defaults to disabled. These fields require migration `0090_product_pos_options.sql` and the updated Worker.
4. Send `POST /sales` with one or more lines. Each line has a `product_id` and `quantity`, plus a `portion_id` or `modifier_ids` when applicable. Supply a `table_id` when using a table and a `customer_id` to override the profile default. The response is the server-priced bill with a revision, line snapshots, and receipt configuration.
5. Use `PATCH /sales/{id}` with the current `revision` to edit a bill. Supplying `lines` replaces and reprices the entire set. Omit `lines` to keep the saved quote while changing fields such as the note or table. To cancel an unpaid bill, send `POST /sales/{id}/cancel` with `revision` and `reason`.
6. Send `POST /sales/{id}/checkout` with the saved `revision`, `expected_total_minor`, and all payments. Use the returned sale and its `receipt` object to print the configured number of copies. Store the sale ID and track printing separately so an HTTP retry does not print another copy.

`GET /sales` accepts `status`, `business_date`, `table_id`, `shift_id`, and `working_day_id` filters. Use `GET /sales/{id}` for saved lines, payments, and receipt data. IDs and the optional customer and table labels are historical snapshots. UTC timestamps use ISO 8601 and business dates use `YYYY-MM-DD`.

When `capabilities.submit_orders` is available, send `POST /sales/{id}/submit` with a stable register-generated sale ID and the same bill fields as `POST /sales`. The unpaid sale and its lines have status `submitted`. Use a new idempotency key to update the submitted order and reuse the same sale ID at checkout or cancellation.

With `capabilities.order_line_history`, send a stable `line_key` for each item and a shared `order_session` and UTC `ordered_at` for items submitted together. The server records the authenticated operator. Resubmitting the bill with an earlier submitted line omitted moves that row into `voided_lines`. Active `lines` and bill totals exclude voided items. Adding the same product in a later session requires a new line key.

With `capabilities.order_line_void_reasons`, send removed quantities in `voided_lines` with their `source_line_key`, `line_key`, `quantity`, `void_reason`, and any allocated `discount_minor`. A partial deletion uses a fresh line key for the voided units and retains the original key on the remaining units. A full deletion uses the original key for the void. Saved reasons for reuse are local to the register.

For POS Sales history, use `GET /sales?history=active` with pagination. It returns `history_scope` with the profile, period kind, period ID, and opening time, plus `item_quantity` on each row. It includes profile bills that are still open, paid sales posted in the active period, and bills cancelled during that period. The period is the current shift, open working day, or current business date, according to the profile settings. When a required period is closed, the scope is null and the list is empty. Use this mode without the other sales filters.

When `GET /context` reports `capabilities.sale_context_guard`, clients can send `expected_context` when creating, editing, or checking out a bill. Include the original `business_date`, `working_day_id`, and `shift_id`. Use JSON null for a disabled day or shift. The server rejects a changed context with `409 SALE_CONTEXT_CHANGED`. A retry with the original idempotency key can still replay an operation that already committed.

## Amounts and settlement

Money uses integer POS units. USD uses cents and KHR uses whole riel. A sale stores the primary business currency and its exchange rate. The rate is the secondary currency’s major units per primary major unit. For example, when USD is primary and the rate is `"4000"`, USD 5.00 is KHR 20,000. eMenu nets payments in each currency, converts the total secondary amount once, and rounds half up to the nearest primary POS unit.

Tax is disabled, inclusive, or exclusive. The optional `discount_minor` on each bill line is an amount against its pretax subtotal in the sale's currency units (USD cents or whole KHR). You can discount up to the line subtotal. The selected tax rule controls whether each level uses the discounted base and which earlier taxes it includes. Inclusive prices are split into pretax subtotal and tax, with cumulative rounding so the parts match the listed price before discounts. Exclusive tax is rounded at each level.

When `/context` advertises `capabilities.cart_line_edits`, a line can include a nonnegative `base_price_override_minor` in its currency units. It replaces the product or portion price before modifier prices are added. `is_free: true` makes the whole line free, including the modifiers, and requires a zero line discount. The override, free status, and optional `note` (up to 500 characters) are returned with the saved line. Omit the override to use the catalog price. A zero-total sale can settle with an empty `payments` array.

The sale and every line return `discount_minor`, `tax_1_amount`, `tax_2_amount`, `tax_3_amount`, `total_tax_amount`, and `total_amount` in the same integer currency units. `total_tax_amount` is the sum of the three levels. `total_amount` is `subtotal_minor - discount_minor + total_tax_amount`. The existing `tax_minor` and `total_minor` carry the same totals. The sale sums its line amounts, and a reversal negates them. Sale detail includes the saved `tax_rule` snapshot, which an offline store can also supply with its checkout payload.

Here is a checkout for a USD 10.00 bill at a rate of 4,000 riel per dollar. Cash tender of USD 6.00 with USD 1.00 change leaves USD 5.00. A KHR 20,000 QR payment covers the rest.

```json
{
  "revision": 1,
  "expected_total_minor": 1000,
  "payments": [
    { "payment_type_id": "cash-id", "currency": "USD", "amount_minor": 600 },
    {
      "payment_type_id": "cash-id",
      "currency": "USD",
      "entry_type": "change",
      "amount_minor": 100
    },
    {
      "payment_type_id": "qr-id",
      "currency": "KHR",
      "amount_minor": 20000,
      "reference": "processor-123"
    }
  ]
}
```

Send positive input amounts for tender and change. Change is returned as a negative entry and can only use a currency tendered in cash on that sale. The resulting payments must exactly match the saved total in primary units. Use an accepted primary-currency tender for any remainder when the secondary amount cannot represent the total. A zero-value bill can check out with an empty payments array. Send processor references only after the corresponding external payments succeed. The reference field accepts a transaction ID.

An owner or manager can send `POST /sales/{id}/reverse` with a `reason` to record a full refund or correction. The API creates one linked reversal sale with inverse totals and payment entries. It posts the reversal to the current day and shift where enabled. The original sale and receipt are retained, and sale detail links to the reversal. When `capabilities.reversal_context_guard` is available, supply `expected_context` and the original `expected_total_minor` to confirm the displayed operating context and receipt. Both fields are required for an offline reversal import. An identical retry returns the saved result. A separate request for an already reversed sale receives `SALE_ALREADY_REVERSED`.

## Cash and closing

- Set `allow_cash_float` on a profile’s payment type to allow or disallow opening balances and cash movements for that method. An explicit `true` enables cashier shifts. Older configurations that omit the field allow floats for cash methods when shifts are enabled.
- Send `POST /cashier-shifts/{id}/cash-floats` with `kind` of `cash_in` or `cash_out`, `payment_type_id`, `currency`, `amount_minor`, and `reason`. The shift uses the payment settings saved when it opened. Use the same path with `GET` to read the opening balances and recorded movements.
- Read `GET /cashier-shifts/{id}/reconciliation` for the payment rows and their activity revision. Open-shift expected amounts are returned to managers and owners. Completed reconciliations include expected, declared, and variance amounts. Totals include opening cash, movements, payments, and reversals. When a cash payment type changes, historical cash reversals use the current drawer for that currency where available.
- Send the declarations and activity revision to `POST /cashier-shifts/{id}/reconciliation` to review discrepancies without closing. If activity changed, reload the preview and verify the entries again.
- Send `POST /cashier-shifts/{id}/close` with the preview’s `activity_revision` and a `counts` array containing one `payment_type_id`, `currency`, and `declared_minor` for each preview row. Send actual counts and settlement totals. Declared cash is zero or positive. Noncash settlement totals can be negative after reversals. The closed shift stores expected and declared amounts and variance as declared minus expected.
- If the close returns a conflict, reload the reconciliation and verify the count before resubmitting. Open bills can carry into a later shift on the same profile. A manager can close the working day using `POST /working-days/{id}/close` with an empty JSON object once all linked shifts and open bills are resolved.
- Read `GET /cashier-shifts/{id}/summary` for shift sales, tenders, and cash activity. Managers can request `scope=branch` for a completed shift in their branch. The history list at `GET /cashier-shifts?closed=true` accepts `business_date`. Manager branch history also accepts `profile_id` and `opened_by`.
- Managers use `GET /working-days/{id}/summary` to see day totals and closing blockers. `POST /cashier-shifts/{id}/reopen` accepts a reason and reopens only the latest eligible shift on the profile. Reopening archives the previous reconciliation in the back-office shift audit. A linked working day must still be open.
- After an ambiguous write, `GET /commands/{idempotency-key}` returns the saved result for the original operator and profile. A missing result can be retried using the same request and key.
- Apply migration `0079_pos_shift_management.sql` and update the Worker before rolling out this register version. The Worker advertises `capabilities.shift_management` when it accepts the new store operations.

If cashier shifts are disabled, the profile can still accept cash and other payments. Cash movements and closing counts are associated with cashier shifts.

## Retries and errors

Send `Content-Type: application/json` and an `Idempotency-Key` on every register write that opens, edits, posts, cancels, reverses, or closes operating activity. Use a new key per intended action. A UUID works. Persist the key and payload before sending a payment recording or another write. After a timeout or transient `5xx`, repeat the same method, path, and body with the same key on the same profile and operator account. A committed replay returns its original status and body, including after a new POS sign-in.

Errors use `{"error":"message","code":"MACHINE_CODE"}`. An unexpected server error includes a `request_id` for support.

| HTTP status         | Client action                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `400`, `413`, `415` | Check the body, IDs, amount, request size, or media type                                                   |
| `401`               | Sign in again or check the credentials                                                                     |
| `402`               | Check subscription status. Authorized reads and closure or cancellation of existing activity are available |
| `403`               | Select a profile, use the appropriate token, or verify the operator’s grant or role                        |
| `404`               | Refresh the resource list for the active profile or branch                                                 |
| `409`               | Inspect `code` and refresh the relevant bill, profile, day, shift, or reconciliation                       |
| `429`               | Wait until the login rate-limit window ends                                                                |

Examples of business conflicts include `WORKING_DAY_REQUIRED`, `CASHIER_SHIFT_REQUIRED`, `TABLE_OCCUPIED`, `BILL_CHANGED`, `PAYMENT_TOTAL_MISMATCH`, `WORKING_DAY_HAS_ACTIVITY`, and `RECONCILIATION_CHANGED`. `IDEMPOTENCY_CONFLICT` means a committed key already belongs to a different request. Use a new key for a corrected action after resolving a business conflict.

## Runnable smoke test

Use a dedicated test branch. Set up a profile with working days and shifts enabled, cash and QR in the business currency, and an eligible product. Use an owner or manager account. Set these environment variables in PowerShell and run the first phase.

```powershell
$env:POS_API_BASE = 'http://localhost:8787'
$env:POS_BUSINESS_SLUG = 'test-business'
$env:POS_EMAIL = 'owner@example.test'
$posPassword = Read-Host 'POS test password' -AsSecureString
$env:POS_PASSWORD = [System.Net.NetworkCredential]::new('', $posPassword).Password
$env:POS_PROFILE_ID = 'replace-with-profile-id'
$env:POS_PRODUCT_ID = 'replace-with-product-id'
$env:POS_RUN_ID = [guid]::NewGuid().ToString()
node docs/examples/pos-api-smoke.mjs open
```

If the profile requires a table, set `POS_TABLE_ID`. Set `POS_PORTION_ID` if the chosen product requires a portion, and choose a product that can be sold without required modifiers. Save the three IDs from the command output. After midnight in the business time zone, run the second phase with the same run ID. For a same-day local smoke test, set `POS_DEMO_SAME_DAY=1`.

```powershell
$env:POS_WORKING_DAY_ID = 'replace-with-output-id'
$env:POS_SHIFT_ID = 'replace-with-output-id'
$env:POS_SALE_ID = 'replace-with-output-id'
$env:POS_DEMO_QR_REFERENCE = 'simulated-qr-transaction'
node docs/examples/pos-api-smoke.mjs settle
Remove-Item Env:POS_PASSWORD
```

The second phase records simulated split cash and QR payments, renders the receipt to stdout, and closes the shift with simulated declared amounts before closing the working day. For the two-profile staging check, sign in on a second profile at the branch while the first day is open. Confirm both profiles see the same working day and have independent shifts, bills, and counts. Resolve the second profile’s activity before the manager closes the day.

Apply the additive D1 migration before deploying the Worker candidate. Run the staging flow against a separate staging Worker and D1 database, then follow the [existing production rollout](production-deployment.md#6-staged-rollout-for-active-businesses) for pilot provisioning.
