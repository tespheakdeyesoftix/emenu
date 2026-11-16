# eMenu POS development plan

## Register experience

- Ship Windows first. Use Flutter and GetX for a shared register interface with a navigation rail at desktop and tablet widths, and bottom navigation plus a drawer at phone widths. Default to Khmer with an English switch. Use large touch targets, a persistent cart and total, and short action labels.
- Keep one register flow for retail, restaurants, cafés, bakeries, florists, takeaway, and dine-in. Read the profile to select the catalog, table mode, required day and shift, payment methods, currencies, tax, customer default, and receipt options. Support product search, portions and modifiers, split tender, change, cash movements, reconciliation, receipts, and manager reversals. Provide barcode entry when a catalog product has a code.
- Split shared widgets by job, including navigation, amount entry, product selection, cart lines, payment entry, confirmation, and sync status. Keep GetX controllers out of pricing, storage, and network logic so those parts can run in automated tests.

## Owner setup and staff access

1. On a new installation, the business owner enters the API address, business slug, account email, and password online. Authenticate with eMenu POS API v1, verify the owner role, select an authorized profile, and provision the installation as the store register or pair it to that register.
2. On each device, a staff member signs in online with their POS username or eMenu email and password the first time and enrolls a local PIN. An owner or manager assigns usernames to staff with profile access. The activated register resolves a username with its saved owner or manager session and computes the password proof locally. On later visits, the staff member selects their account and unlocks with the PIN. Store a salted verifier and protect the device keys and server renewal credentials with the OS credential store.
3. Store access by business, branch, profile, device, and operator. Enforce role checks on the hub for privileged operations and refresh staff access on reconnect. A device password login establishes its own access. Each staff action retains its operator ID throughout synchronization.

## Local operation and multiple devices

- Use **Drift with SQLite** for both the register and paired tills. The store register owns one durable branch database. It keeps the branch working day and a single ordered sync journal. It scopes catalogs, shifts, drawers, bills, and payments to each till's profile. Paired tills keep a local cache and submit shared operations to the hub over the store network.
- Pair tills to the designated register using a one-time pairing code, a verified hub certificate, and a revocable device credential. The hub processes commands in order and checks the bill revision. A till gets a success response only after the operation and its sync entry commit together. Till retries use the same command ID and receive the saved result.
- The hub stays available on the store network during an internet outage. If a till loses its link to the hub, it can retain a cart locally and resume shared checkout when the hub becomes reachable. Keep open bills attached to the branch day and use the settling cashier shift for sales. Restore the hub database and pending sync entries after a restart.
- Save prices, taxes, exchange rates, business dates, and receipt details at the time of sale. Use integer currency amounts and match the API’s per-line tax and split-currency rounding. Show pending synchronization on the receipt and in the sales history. Track reprints separately from checkout.

## Cloud synchronization

- Reuse eMenu POS v1 for identity, profile configuration, catalog, tables, customers, and shared business records. Extend it with device registration, scoped renewal credentials, and an ordered import for hub operations. The import must preserve original business dates, price and tax snapshots, and operation IDs when accepting work created offline.
- The server records which hub can write each enrolled branch. The handoff procedure drains pending entries and transfers authority before another hub accepts shared sales. This protects shared working days, shifts, and table bills when a device reconnects or a hub is replaced.
- The background worker sends durable entries in order and retries timeouts, rate limits, and transient failures with backoff. It stores the server acknowledgment and any local-to-server ID mapping together. A rejected operation stays visible with its reason and original data so staff can reconcile it without charging or printing twice.
- When a cashier loses access, the owner can approve the head of the journal from the designated register. The approval survives a restart and retries the same envelope. D1 verifies the registered device and operator history, keeps the original operator on the entry, and records the owner and reason with the operation.
- Keep existing POS v1 integrations working for branches using their current setup. Exercise the device protocol against isolated local and hosted test data before using it for a pilot.

## Implementation and acceptance

| Step | Deliverable | Verify |
| --- | --- | --- |
| 1 | Flutter project, Khmer and English labels, responsive shell, API client, and local database | Static analysis, desktop build, narrow and wide layouts, and SQLite reopen |
| 2 | Owner activation, staff enrollment, profile catalog, cart, and offline sale storage | Owner and staff role checks, PIN attempts and reset, retail and table profiles, and crash recovery before and after commit |
| 3 | Hub pairing and shared operations | Two independent app instances on one branch, one shared bill, conflicting edits, shift handoff, and WAN loss while LAN remains up |
| 4 | Server device protocol and background sync | Idempotent retries, duplicate acknowledgments, reconnect after midnight, revoked credentials, and reconciliation against persisted server payments |
| 5 | Windows release, receipt setup, and operator instructions | Install and upgrade against an existing local database, touchscreen layout, representative printer output, and end-to-end pilot acceptance |

Run the tests with profile fixtures for counter sales, table service, different catalog modes, tax settings, portions and modifiers, USD and KHR, split tender, cash in and out, and shift close. Verify paired registers can recover from hub restart and report conflicts without losing saved transactions.

## Hosted staging verification

Apply the D1 migrations and deploy the Worker to the isolated staging environment. From `apps/pos`, set `POS_STAGING_CONFIG` to the staging Wrangler JSON file, `POS_STAGING_D1_ID` to its D1 database ID, `POS_STAGING_ORIGIN` to its `workers.dev` origin, and `POS_DART_EXECUTABLE` to the SDK's `dart.exe`. Run `node tool/hosted_branch_smoke.mjs`.

The script creates a fixture business and staff account, pairs three tills across two profiles, simulates an internet outage, and verifies replay and reconciliation against hosted D1 after a register restart. It checks that the profiles share the working day, keep independent drawer counts, and return only their own sales. Set `POS_STAGING_RECOVERY=1` to remove the fixture cashier's access during the outage and verify the owner recovery audit. Run the physical 58 mm or 80 mm receipt check from the Windows build with the shop printer.

For the native Windows checkout test, set `POS_STAGING_NATIVE=1` and `POS_FLUTTER_EXECUTABLE` to the SDK's `flutter.bat`, then run the same script from `apps/pos`. The test uses a temporary SQLite database and fixture-specific Windows secure storage keys. It activates the register, sets up the staff PIN, pays at a table in USD and KHR, and rasterizes the two-copy 58 mm receipt through the Windows PDF plugin. A second process unlocks with the staff PIN during a simulated outage and checks the saved cart, sale, and print record.

Set `POS_NATIVE_SCREENSHOTS` to an output folder to save screenshots of the cashier register, split payment, and Khmer receipt using the staging fixture.
