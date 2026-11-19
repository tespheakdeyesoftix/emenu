import '../../../core/user_permissions.dart';
import 'dart:convert';

import 'package:get/get.dart';
import 'package:uuid/uuid.dart';

import '../../../core/api_endpoint.dart';
import '../../../core/bill_information.dart';
import '../../../core/register_operating.dart' show registerLocalDate;
import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../core/register_authority.dart';
import '../../../core/register_database.dart';
import '../sales_register.dart';
import 'cart_action.dart';
import 'cart_line.dart';
import 'catalog_navigation.dart';
import 'customer/customer_directory.dart';
import 'sale_screen_settings.dart';

part 'draft_methods.dart';
part 'held_bill_methods.dart';
part 'reversal_methods.dart';
part 'bill_information_methods.dart';
part '../table/table_methods.dart';

class SaleService extends GetxService {
  SaleService(this.register);

  final SalesRegister register;
  final cart = <CartLine>[].obs;
  final voidedLines = <CartLine>[].obs;
  final screenSettings = const SaleScreenSettings().obs;
  final tableId = RxnString();
  final tableGroupId = RxnString();
  final guestCover = RxnInt();
  final selectedPostingDate = RxnString();
  int billGeneration = 0;
  final customerId = RxnString();
  final saleNote = RxnString();
  final _parkedTableIds = <String>{}.obs;
  final _activeBill = Rxn<({String id, int revision})>();
  final _quoteContext = Rxn<Json>();
  Future<void> _cartWrites = Future.value();
  bool _cartSaveFailed = false;

  static const sellTab = SalesRegister.sellTab;
  static const tablesTab = SalesRegister.tablesTab;
  RegisterDatabase get database => register.database;
  Rxn<RegisterInstallation> get installation => register.installation;
  Rxn<RegisterOperator> get operator => register.operator;
  RxBool get busy => register.busy;
  RxBool get commandPending => register.commandPending;
  RxBool get paired => register.paired;
  RxBool get online => register.online;
  RxnString get message => register.message;
  RxInt get tab => register.tab;
  RxList<HeldBill> get heldBills => register.heldBills;
  RxList<(LocalSale, SaleOutboxData)> get pending => register.pending;
  Json get context => register.context;
  Json get config => register.config;
  List<Json> get products =>
      catalogNavigation.scopedProducts(jsonRows(catalog['products']));
  List<Json> get tables => register.tables;
  List<Json> get customers => register.customers;
  CustomerDirectory get customerDirectory => CustomerDirectory(customers);
  String? get defaultCustomerId =>
      quoteConfig['default_customer_id'] as String?;
  String? get effectiveCustomerId => customerId.value ?? defaultCustomerId;
  Json? get selectedCustomer => customerDirectory.byId(effectiveCustomerId);
  bool get hasCustomCustomer =>
      customerId.value != null && customerId.value != defaultCustomerId;
  bool get storeOperations => register.storeOperations;
  bool get storeAuthorityPending => register.storeAuthorityPending;
  void selectTab(int destination) => register.selectTab(destination);

  Json get _quoted => _quoteContext.value ?? context;
  Json get quoteConfig => _quoteContext.value == null
      ? config
      : billRequested
      ? jsonObject(jsonObject(_quoted['profile'])['config'])
      : withCurrentTaxSettings(
          jsonObject(jsonObject(_quoted['profile'])['config']),
          config,
        );

  Json get business => jsonObject(_quoted['business']);
  String get currency => business['currency'] as String;
  String get exchangeRate => business['secondary_exchange_rate'].toString();
  List<Json> get quotePaymentTypes => jsonRows(_quoted['payment_types']);
  String get tableMode => config['table_mode'] as String? ?? 'disabled';
  Json get operatingContext => register.operatingContext;
  BillTotals totalOf(CartLine line) => line.totals(quoteConfig);
  int get cartTotal => cart.fold(0, (sum, line) => sum + totalOf(line).total);

  BillTotals previewTotalOf(CartLine line) {
    try {
      return totalOf(line);
    } on DiscountExceedsSubtotal {
      final subtotal = totalOf(line.withQuantity(line.quantity, discount: 0)).subtotal;
      return totalOf(line.withQuantity(line.quantity, discount: subtotal));
    }
  }

  int get cartPreviewTotal =>
      cart.fold(0, (sum, line) => sum + previewTotalOf(line).total);
  bool get needsDiscountReview =>
      cart.any((line) => line.discount > 0 && previewTotalOf(line).discount != line.discount);

  Json get catalog => jsonObject(register.snapshot.value?['catalog'] ?? {});
  List<Json> get catalogNodes => catalogNavigation.nodes;
  Json get _catalogConfig {
    final context = jsonObject(register.snapshot.value?['context'] ?? {});
    final profile = jsonObject(context['profile'] ?? {});
    return jsonObject(profile['config'] ?? {});
  }

  bool get restrictToDefaultMenu =>
      (catalog['mode'] == 'menu' || _catalogConfig['catalog_mode'] == 'menu') &&
      (_catalogConfig['catalog_mode'] == 'menu' ||
          jsonRows(catalog['nodes']).isNotEmpty);
  String? get rootMenuId => _catalogConfig['default_menu_id'] as String?;
  CatalogNavigation get catalogNavigation => CatalogNavigation(
    catalog,
    rootId: rootMenuId,
    restrictToRoot: restrictToDefaultMenu,
  );
  String? get catalogMenuIssue => !restrictToDefaultMenu
      ? null
      : rootMenuId == null || rootMenuId!.isEmpty
      ? 'DEFAULT_MENU_REQUIRED'
      : !catalogNavigation.byId.containsKey(rootMenuId)
      ? 'DEFAULT_MENU_UNAVAILABLE'
      : null;

  Future<bool> reloadMenu() => register.reloadMenu();

  Future<void> loadScreenSettings() async {
    screenSettings.value = SaleScreenSettings.fromJson(
      await database.readUiPreferences(),
    );
  }

  Future<bool> saveScreenSettings(SaleScreenSettings settings) async {
    var saved = false;
    await register.run(() async {
      if (!settings.validOrderWidth) {
        throw const FormatException('INVALID_ORDER_WIDTH');
      }
      if (!settings.validCatalogWidth) {
        throw const FormatException('INVALID_CATALOG_WIDTH');
      }
      await database.saveUiPreferences(
        settings.layout.key,
        settings.orderProductListWidth,
        catalogWidth: settings.catalogWidth,
      );
      screenSettings.value = settings;
      saved = true;
    });
    return saved;
  }

  List<Json> filterProducts({required String term, String? section}) {
    final navigation = catalogNavigation;
    final sectionIds = term.isEmpty && section != null
        ? navigation.sectionIds(section)
        : null;
    final source = jsonRows(catalog['products']);
    final candidates = sectionIds == null
        ? navigation.scopedProducts(source)
        : source;
    final seen = <String>{};
    return candidates.where((product) {
      final matches = term.isEmpty
          ? sectionIds == null ||
                navigation.assignments(product).any(sectionIds.contains)
          : ['name', 'name_en', 'name_km', 'name_zh', 'code'].any(
              (key) =>
                  product[key]?.toString().toLowerCase().contains(term) ??
                  false,
            );
      return matches && seen.add(product['id'] as String);
    }).toList();
  }

  Json? productByCode(String input) {
    final code = input.trim().toLowerCase();
    if (code.isEmpty) return null;
    final matches = products.where(
      (row) => row['code']?.toString().toLowerCase() == code,
    );
    return matches.length == 1 ? matches.single : null;
  }

  CartLine withOptions(CartLine original, CartLine next) => next
      .withQuantity(original.quantity, order: original.order)
      .withLineEdits({
        ...original.lineEdits,
        if (next.portion?['id'] != original.portion?['id'])
          'base_price_override_minor': null,
      });

  CartLine restorePrice(CartLine line) => line.withLineEdits({
    ...line.lineEdits,
    'is_free': false,
    'free_reason': null,
  });

  bool validLineAmount(CartLine line, String key, String input) {
    final amount = parseAmount(input, currency);
    if (amount == null) return false;
    try {
      totalOf(line.withLineEdits({...line.lineEdits, key: amount}));
      return true;
    } on FormatException {
      return false;
    }
  }

  Future<void> recordReceiptPrint(
    LocalSale sale,
    String operatorId,
    int copies,
  ) => database.recordReceiptPrint(sale.id, operatorId, copies);

  bool get canPay =>
      cart.isNotEmpty &&
      !commandPending.value &&
      !busy.value &&
      !needsDiscountReview &&
      !register.needsOperatingSetup &&
      (tableMode != 'required' || tableId.value != null) &&
      !storeAuthorityPending &&
      (!paired.value || online.value) &&
      allowsAction('allow_process_payment');

  bool get canSubmit =>
      (cart.isNotEmpty ||
          (_activeBill.value != null && voidedLines.isNotEmpty)) &&
      cartEditable &&
      !needsDiscountReview &&
      !register.needsOperatingSetup &&
      (tableMode != 'required' || tableId.value != null) &&
      !storeAuthorityPending &&
      (!paired.value || online.value);

  void clearSession() {
    clearCart();
    _parkedTableIds.clear();
    tableGroupId.value = null;
  }

  void clearCart() {
    cart.clear();
    voidedLines.clear();
    tableId.value = null;
    guestCover.value = null;
    selectedPostingDate.value = null;
    billGeneration++;
    customerId.value = null;
    saleNote.value = null;
    _activeBill.value = null;
    _quoteContext.value = null;
  }

  bool get billRequested => activeSaleStatus == "bill_requested";
  bool allowsAction(String key) => allowsUserAction(context, operator.value?.role ?? "", key);
  bool get cartEditable => !commandPending.value && !busy.value && !billRequested;

  bool get supportsCartLineEdits =>
      (context['capabilities'] as Map?)?['cart_line_edits'] == true &&
      (!paired.value || context['store_cart_line_edits'] == true);

  bool get supportsFreeItemReasons =>
      supportsCartLineEdits &&
      (!paired.value || context['store_free_item_reasons'] == true);

  bool get supportsItemDiscountDetails =>
      !paired.value || context['store_item_discount_details'] == true;

  bool get supportsSaleNotes =>
      !paired.value || context['store_sale_notes'] == true;

  bool checkProductEdit(CartLine line, CartProductEdit edit) {
    final permission = switch (edit) {
      CartProductEdit.price => "allow_change_product_price",
      CartProductEdit.free => "allow_free_item",
      CartProductEdit.discount => "allow_discount_on_item",
    };
    if (!allowsAction(permission)) { message.value = "PERMISSION_DENIED"; return false; }
    final current = (catalog['products'] as List?)
        ?.whereType<Map>()
        .where((product) => product['id'] == line.product['id'])
        .firstOrNull;
    final allowed = current?[edit.option] ?? line.product[edit.option];
    if (allowed != false) return true;
    message.value = edit.warning;
    return false;
  }

  bool get hasCartDraft => cart.isNotEmpty || _hasBillDetails;

  bool get _hasBillDetails =>
      _activeBill.value != null ||
      tableId.value != null ||
      guestCover.value != null ||
      selectedPostingDate.value != null ||
      saleNote.value != null ||
      customerId.value != null;

  bool setSaleNote(String note) {
    if (!cartEditable || !supportsSaleNotes || note.length > 500) return false;
    saleNote.value = note.isEmpty ? null : note;
    _saveCart();
    return true;
  }

  void selectCustomer(String? id) {
    if (!cartEditable) return;
    customerId.value = id;
    _saveCart();
  }

  bool get hasNewOrderItems {
    final newLines = cart.where((line) => !line.submitted);
    if (newLines.isEmpty) return false;
    final bill = _activeBill.value;
    if (bill == null) return true;
    final held = heldBills.where((entry) => entry.id == bill.id).firstOrNull;
    final quantities = {
      if (held != null)
        for (final line in CartLine.billLines(
          jsonObject(jsonDecode(held.payload)),
        ))
          line.order['line_key']: line.quantity,
    };
    return newLines.any(
      (line) => line.quantity > (quantities[line.order['line_key']] ?? 0),
    );
  }

  Future<bool> discardCart() async {
    var discarded = false;
    await register.run(() async {
      if (commandPending.value) {
        throw const FormatException('STORE_COMMAND_PENDING');
      }
      await _cartWrites;
      final actor = operator.value;
      final setup = installation.value;
      if (actor != null && setup != null) {
        await database.removeCartDraft(actor.id, setup.profileId);
      }
      clearCart();
      if (tableMode == 'required') tab.value = tablesTab;
      _cartSaveFailed = false;
      discarded = true;
    });
    return discarded;
  }

  CartLine? add(CartLine line) {
    if (!cartEditable) return null;
    try {
      if (cart.isEmpty && _activeBill.value == null) {
        final current = context;
        _quoteContext.value = {
          'profile': current['profile'],
          'business': current['business'],
          'payment_types': current['payment_types'],
        };
      }
      totalOf(line);
      final modifierIds = line.modifiers.map((item) => item['id']).toSet();
      final index = cart.indexWhere(
        (saved) =>
            line.canMerge &&
            saved.canMerge &&
            saved.product['id'] == line.product['id'] &&
            saved.portion?['id'] == line.portion?['id'] &&
            saved.unit == line.unit &&
            saved.quantity + line.quantity <= 999 &&
            saved.modifiers.length == line.modifiers.length &&
            saved.modifiers.every((item) => modifierIds.contains(item['id'])),
      );
      if (index >= 0) {
        final updated = cart[index].withQuantity(
          normalizedQuantity(cart[index].quantity + line.quantity),
        );
        totalOf(updated);
        cart[index] = updated;
        _saveCart();
        return updated;
      }
      if (cart.length >= 60) throw const FormatException('CART_LIMIT');
      final added = _newOrderLine(line);
      cart.add(added);
      _saveCart();
      return added;
    } catch (error) {
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      register.showError(error);
      return null;
    }
  }

  CartLine _newOrderLine(CartLine line) {
    final pending = cart.where((item) => item.canEditQuantity).firstOrNull;
    return line.withQuantity(
      line.quantity,
      order: {
        'status': 'new',
        'ordered_at':
            pending?.order['ordered_at'] ??
            DateTime.now().toUtc().toIso8601String(),
        'ordered_by_name': operator.value?.displayName,
      },
    );
  }

  ({CartLine? remaining, CartLine removed}) _splitLine(CartLine line, num count) {
    final keep = normalizedQuantity(line.quantity - count);
    // Inclusive tax can round differently after a line is split.
    final share = (line.discount * count / line.quantity).round();
    int discountFor(num qty, int requested) => requested == 0
        ? 0
        : requested
              .clamp(0, totalOf(line.withQuantity(qty, discount: 0)).subtotal)
              .toInt();
    final removedDiscount = discountFor(count, share);
    return (
      remaining: keep == 0
          ? null
          : line.withQuantity(
              keep,
              discount: discountFor(keep, line.discount - removedDiscount),
            ),
      removed: line.withQuantity(count, discount: removedDiscount),
    );
  }

  CartLine _voidPortion(
    CartLine portion, {
    required bool partial,
    required String reason,
  }) => portion.withQuantity(
    portion.quantity,
    order: {
      ...portion.order,
      'status': 'void',
      'source_line_key': portion.order['line_key'],
      if (partial) 'line_key': const Uuid().v4(),
      'void_reason': reason,
    },
  );

  Future<CartLine?> markItemFree(
    CartLine line,
    num count,
    String reason, {
    required bool remember,
  }) async {
    final text = reason.trim();
    if (!cartEditable ||
        !supportsFreeItemReasons ||
        line.isFree ||
        line.voided ||
        !validSaleQuantity(count) ||
        count > line.quantity ||
        text.isEmpty ||
        text.length > 250) {
      return null;
    }

    CartLine? result;
    await register.run(() async {
      final index = cart.indexOf(line);
      if (index < 0 || commandPending.value) return;
      if (!checkProductEdit(line, CartProductEdit.free)) return;
      final split = _splitLine(line, count);
      final remaining = split.remaining;
      if (remaining != null && cart.length >= 60) {
        throw const FormatException('CART_LIMIT');
      }
      final free = _newOrderLine(split.removed.withLineEdits({
        ...split.removed.withDiscount().lineEdits,
        'is_free': true,
        'free_reason': text,
      }));
      totalOf(free);
      if (remaining != null) totalOf(remaining);

      final items = cart.toList()..replaceRange(index, index + 1, [
        if (remaining != null) remaining,
        free,
      ]);
      final voids = [
        ...voidedLines,
        if (line.submitted)
          _voidPortion(split.removed, partial: remaining != null, reason: text),
      ];
      final writeDraft = _draftWriter(items, voids);
      await _cartWrites;
      await database.transaction(() async {
        if (remember) await database.rememberFreeItemReason(text);
        await writeDraft();
      });
      cart.assignAll(items);
      voidedLines.assignAll(voids);
      _cartSaveFailed = false;
      result = free;
    });
    return result;
  }

  Future<CartLine?> deleteQuantity(
    CartLine line,
    num count,
    String reason,
    bool remember,
  ) async {
    CartLine? remaining;
    if (!cartEditable || reason.trim().isEmpty || reason.length > 250)
      return null;
    await register.run(() async {
      final index = cart.indexOf(line);
      if (index < 0 ||
          !validSaleQuantity(count) ||
          count > line.quantity ||
          commandPending.value)
        return;
      final split = _splitLine(line, count);
      final kept = split.remaining;
      final nextCart = cart.toList();
      final nextVoids = voidedLines.toList();
      if (kept == null) {
        nextCart.removeAt(index);
      } else {
        totalOf(kept);
        nextCart[index] = kept;
      }
      if (line.submitted) {
        final removed = _voidPortion(
          split.removed,
          partial: kept != null,
          reason: reason.trim(),
        );
        totalOf(removed);
        nextVoids.add(removed);
      }
      final writeDraft = _draftWriter(nextCart, nextVoids);
      await _cartWrites;
      await database.transaction(() async {
        await database.recordItemDeletion(
          product: line.product['id'] as String,
          quantity: count,
          reason: reason.trim(),
          remember: remember,
          operatorId: operator.value?.id,
          billId: _activeBill.value?.id,
        );
        await writeDraft();
      });
      cart.assignAll(nextCart);
      voidedLines.assignAll(nextVoids);
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      _cartSaveFailed = false;
      remaining = kept;
    });
    return remaining;
  }

  void quantity(int index, int amount) {
    if (!cartEditable || index < 0 || index >= cart.length) return;
    if (amount <= 0) {
      final removed = cart.removeAt(index);
      if (removed.submitted) {
        voidedLines.add(
          removed.withQuantity(
            removed.quantity,
            order: {...removed.order, 'status': 'void'},
          ),
        );
      }
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      _saveCart();
    } else if (cart[index].canEditQuantity && amount <= 999) {
      replaceCartLine(cart[index], cart[index].withQuantity(amount));
    }
  }

  CartLine? replaceCartLine(CartLine original, CartLine replacement) {
    final index = cart.indexOf(original);
    if (!cartEditable || index < 0) return null;
    if (!original.canEditQuantity && replacement.quantity != original.quantity) {
      return null;
    }
    try {
      if (replacement.hasLineEdits && !supportsCartLineEdits) {
        throw const FormatException('CART_LINE_UPGRADE_REQUIRED');
      }
      totalOf(replacement);
      cart[index] = replacement;
      _saveCart();
      return replacement;
    } catch (error) {
      register.showError(error);
      return null;
    }
  }

  CartLine? reorderCartLine(CartLine line) {
    if (!cartEditable || line.voided || !cart.contains(line)) return null;
    if (line.canEditQuantity) {
      final quantity = normalizedQuantity(line.quantity + 1);
      if (!validSaleQuantity(quantity)) return null;
      return replaceCartLine(line, line.withQuantity(quantity));
    }
    try {
      final product = cartCatalogProduct(line);
      if (product == null) return null;
      return add(
        CartLine.fromCatalog(product, {
          'portion_id': line.portion?['id'],
          'quantity': 1,
        }, line.modifiers.map((row) => row['id'] as String).toSet()),
      );
    } catch (error) {
      register.showError(error);
      return null;
    }
  }

  Json? cartCatalogProduct(CartLine line) {
    final product = products
        .where((row) => row['id'] == line.product['id'])
        .firstOrNull;
    if (product == null) register.showError(CartLine.unavailable);
    return product;
  }

  Future<void> checkout(List<Json> payments) => register.run(() async {
    requireUserAction(context, operator.value!.role, "allow_process_payment");
    await flushCart();
    await register.sendCommand(RegisterAction.checkout, {
      ..._cartCommand(),
      'payments': payments,
    });
    clearCart();
    if (tableMode == 'required') tab.value = tablesTab;
    message.value = 'SAVED';
    if (storeOperations) await register.refreshAfterStoreOperation();
    register.wakeSaleSync();
  });

  Json _cartCommand() => {
    if (supportsCartLineEdits) 'cart_line_edits_version': 1,
    'bill_id': _activeBill.value?.id,
    'bill_revision': _activeBill.value?.revision,
    'table_id': tableMode == 'disabled' ? null : tableId.value,
    if (promptGuestCover || (tableMode != 'disabled' && tableId.value != null))
      'guest_cover': guestCover.value,
    if (!requiresCashierShift && selectedPostingDate.value != null)
      'posting_date': selectedPostingDate.value,
    'customer_id': customerId.value,
    if (supportsSaleNotes) 'note': saleNote.value,
    'currency': currency,
    'exchange_rate': exchangeRate,
    'total_minor': cartTotal,
    'quote': cart.map((line) => line.quote(quoteConfig)).toList(),
    if (voidedLines.isNotEmpty)
      'voided_lines': voidedLines
          .where((line) => line.order['void_reason'] != null)
          .map((line) => line.request)
          .toList(),
    'expected_context': operatingContext,
  };
}
