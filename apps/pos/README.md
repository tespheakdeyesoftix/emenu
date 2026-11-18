# eMenu POS

Flutter register for eMenu POS API v1. Khmer is the default language. Use the language button to switch to English.

Run `emenu_pos.exe` from its Windows release folder with the bundled DLLs and `data` directory. Close the previous POS window before opening an updated build.

## Local setup

1. Start the eMenu API from the repository root with `npm run db:migrate:local` and `npm run dev:api`.
2. Configure a POS profile, payment types, and a catalog on the local API. Use a business owner for the first register setup. Follow the [POS API guide](../../docs/pos-api.md).
3. In this directory, run `flutter pub get` and `flutter run -d windows`. Windows builds need permission to create plugin links and the Desktop development with C++ workload. Standalone Visual Studio Build Tools 2022 works with MSVC, CMake, the Windows SDK, and C++ ATL (x86 and x64) for the secure storage plugin.
4. Enter the API origin and business slug, then sign in with the owner's account email and password. Select the POS profile. The first sign-in offers a six-digit PIN. Select **Skip** to continue with password sign-in. An owner or manager can open **Staff usernames** to set a username for a staff member who has profile access. Staff use their username or eMenu email and password. Use **Profile** at the bottom of the desktop rail to set or change a local PIN.

The register uses Drift with SQLite and stores its database in the app support directory. Operator PIN verifiers and POS session tokens use the OS credential store. The sales screen uses the cached profile catalog when the internet is unavailable.

### Sign in to the right local business

An activated register keeps its API address and business slug. The sign-in screen shows both. An account from another business cannot sign in to that register, even with the correct password.

For local development, use `POS_DATA_PROFILE` to select a separate register database in a named subfolder of the app support directory. This keeps the default register's saved data available. For the existing bakery register, run:

```powershell
flutter run -d windows --debug --dart-define=POS_DATA_PROFILE=pheakdey-backery-local
```

Check that the sign-in screen shows `pheakdey-backery` and the same API used by Super Control. An activated bakery register connected to a local loopback API opens the password form with the demo cashier prefilled in debug builds. Enter the owner's credentials when testing owner tasks. In Super Control, generating or copying a temporary password does not save it: click **Reset credentials** and wait for **Account credentials reset** before using it. After signing in, select the profile and choose whether to set a six-digit PIN.

Profile names accept up to 64 letters, digits, hyphens, or underscores and must start with a letter or digit. A new name starts register setup; omitting `POS_DATA_PROFILE` uses the default register database.

## Table service

**Sell** opens the sale screen in disabled and optional table modes. In optional mode, staff can assign a table, return the bill to the counter, or open the table plan from the Sell toolbar. In required mode, **Sell** opens the table plan with the groups configured in Control. Tap a table to open a sale or resume its saved order.

**General Info** on the POS profile controls the table colors and the guest count keypad. **Save order**, **Hold bill**, and **Request bill** set the table state on the store register. To mark a table booked, assign it to a confirmed booking in Control.

## Pair tills on the store network

1. Sign in as the owner on the designated store register. Open **Store devices** and select **Make this the store register**. Choose the store Wi-Fi or Ethernet IPv4 address and copy a pairing code. The store register listens on TCP port 8879.
2. Activate a new till with the owner account and a profile in the same branch. Open **Store devices**, enter a till name, and paste the code within five minutes. Pair each additional till with a fresh code.
3. Enroll each staff member on the tills they use with their account password and a local PIN. Use **Store devices** on the designated register to disconnect a till.

While online, finish existing days, shifts, and held bills and sync their sales. On the designated register, open **Store devices** and choose **Enable offline operations**. This assigns branch writes to that register. Keep it running on the store network for paired tills.

During an internet outage, tills on the same profile share shifts and held bills and can settle sales and post cash movements. Profiles that use working days share the branch day. An owner or manager can close it after all linked shifts and bills are resolved. Each profile has its own drawer totals, and a held bill can carry to the next shift on that profile.

After an interrupted response, the till retries the same command. The store register uploads operations in order when internet access returns. A rejected upload appears under **Shift** with its error and a **Retry** button. Fix the reported access or data issue, then retry. To move the branch to another register, close the day and shifts, settle or discard held bills, wait for sync, and select **Release branch** while online.

If an operator loses access before a saved entry uploads, the owner can select **Approve sync** under **Shift** on the designated register. Review the entry and enter a reason. The register saves the approval locally and retries it in order. The entry keeps its original operator. Recovery requires migration `0067_pos_store_recovery.sql` and a Worker that advertises `store_recovery`.

## Sales and synchronization

Open the working day and cashier shift when the profile requires them. Enter the opening cash by currency. Select products and a table when required. Hold a bill to resume it from Sales, or enter the payment entries to complete the sale. The register saves the sale and its sync job together. Sales shows whether each local sale is pending, synced, or needs review, and opens its saved receipt. On registers using the live API workflow, sync the shift’s sales before entering the final counts and closing it.

The current cart saves automatically on the till for the signed-in operator. Unlock the same till to resume it after a restart. Use **Hold** to share the bill with other tills. If another till edited the held bill, use **Discard draft** in the cart and reopen the latest bill from **Sales**. Discarding the local draft keeps the shared bill available.

To print or reprint, open the receipt in **Sales** and select **Print**. Choose 58 mm or 80 mm paper and a Windows printer with the matching roll configured in its driver. The register applies the sale’s saved template and number of copies. Windows reports when it accepts the job, and the register records it separately from the sale.

An owner or manager can open a paid receipt in **Sales**, select **Reverse**, and enter a reason. A designated register can record the full reversal offline and apply it to the current drawer. In live API mode, wait for the reversal to sync before returning payment. Refund card and QR tenders through their payment provider. The original receipt and the reversal can both be printed. Reversals become available after the Worker upgrade and a context refresh.

The sync worker runs while the designated register is open. In offline operations mode, it uploads the original timestamps, prices, taxes, and tenders through `capabilities.store_operations`. On a Worker with `capabilities.device_sessions`, the register renews expiring POS tokens using an installation key held in the OS credential store. If the register’s older token already expired before the upgrade, sign in once with a password to enroll its key.

Offline operations require the Worker update and migration `0065_pos_store_authority.sql`. The [development plan](DEVELOPMENT.md) covers pilot and hardware verification.

Username sign-in requires the Worker update and migration `0066_pos_staff_usernames.sql`. An owner or manager needs a valid saved session on the till for username sign-in. Staff can use their eMenu email on an activated till if the owner session needs renewal.

## Development checks

```text
dart run build_runner build
flutter analyze
flutter test
flutter build windows --release
```

To exercise paired Dart tills on two profiles through an offline day, split payment and replay against the local Worker, set `POS_DART_EXECUTABLE` to the SDK's `dart.exe` and run `npm run test:pos-api` from the repository root.
