import 'dart:convert';

import 'package:get/get.dart';

import '../../../core/api_endpoint.dart';
import '../../../core/bill_information.dart';
import '../../../core/register_operating.dart' show registerLocalDate;
import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../core/register_authority.dart';
import '../../../core/register_database.dart';
import '../sales_register.dart';
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
  final screenSettings = const SaleScreenSettings().obs;
  final tableId = RxnString();
  final tableGroupId = RxnString();
  final guestCover = RxnInt();
  final selectedPostingDate = RxnString();
  int billGeneration = 0;
  final customerId = RxnString();
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
  Json get quoteConfig => jsonObject(jsonObject(_quoted['profile'])['config']);
  Json get business => jsonObject(_quoted['business']);
  String get currency => business['currency'] as String;
  String get exchangeRate => business['secondary_exchange_rate'].toString();
  List<Json> get quotePaymentTypes => jsonRows(_quoted['payment_types']);
  String get tableMode => config['table_mode'] as String? ?? 'disabled';
  Json get operatingContext => register.operatingContext;
  BillTotals totalOf(CartLine line) => line.totals(quoteConfig);
  int get cartTotal => cart.fold(0, (sum, line) => sum + totalOf(line).total);

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

  CartLine withOptions(CartLine original, CartLine next) =>
      next.withQuantity(original.quantity).withLineEdits({
        ...original.lineEdits,
        if (next.portion?['id'] != original.portion?['id'])
          'base_price_override_minor': null,
      });

  CartLine toggleFree(CartLine line) => line.withLineEdits({
    ...line.lineEdits,
    'is_free': !line.isFree,
    'discount_minor': 0,
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

  bool get canSubmit =>
      cart.isNotEmpty &&
      cartEditable &&
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
    tableId.value = null;
    guestCover.value = null;
    selectedPostingDate.value = null;
    billGeneration++;
    customerId.value = null;
    _activeBill.value = null;
    _quoteContext.value = null;
  }

  bool get cartEditable => !commandPending.value && !busy.value;

  bool get supportsCartLineEdits =>
      (context['capabilities'] as Map?)?['cart_line_edits'] == true &&
      (!paired.value || context['store_cart_line_edits'] == true);

  bool get hasCartDraft =>
      cart.isNotEmpty ||
      _activeBill.value != null ||
      tableId.value != null ||
      guestCover.value != null ||
      selectedPostingDate.value != null ||
      customerId.value != null;

  void selectCustomer(String? id) {
    if (!cartEditable) return;
    customerId.value = id;
    _saveCart();
  }

  Future<void> discardCart() => register.run(() async {
    if (commandPending.value) {
      throw const FormatException('STORE_COMMAND_PENDING');
    }
    await _cartWrites;
    await database.removeCartDraft(
      operator.value!.id,
      installation.value!.profileId,
    );
    clearCart();
    if (tableMode == 'required') tab.value = tablesTab;
    _cartSaveFailed = false;
  });

  void add(CartLine line) {
    if (!cartEditable) return;
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
          cart[index].quantity + line.quantity,
        );
        totalOf(updated);
        cart[index] = updated;
        _saveCart();
        return;
      }
      if (cart.length >= 60) throw const FormatException('CART_LIMIT');
      cart.add(line);
      _saveCart();
    } catch (error) {
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      register.showError(error);
    }
  }

  void quantity(int index, int amount) {
    if (!cartEditable || index < 0 || index >= cart.length) return;
    if (amount <= 0) {
      cart.removeAt(index);
      if (cart.isEmpty && _activeBill.value == null) _quoteContext.value = null;
      _saveCart();
    } else if (amount <= 999) {
      replaceCartLine(cart[index], cart[index].withQuantity(amount));
    }
  }

  CartLine? replaceCartLine(CartLine original, CartLine replacement) {
    final index = cart.indexOf(original);
    if (!cartEditable || index < 0) return null;
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

  void reorderCartLine(CartLine line) {
    if (!cartEditable || !cart.contains(line)) return;
    try {
      final product = cartCatalogProduct(line);
      if (product == null) return;
      add(
        CartLine.fromCatalog(product, {
          'portion_id': line.portion?['id'],
          'quantity': 1,
        }, line.modifiers.map((row) => row['id'] as String).toSet()),
      );
    } catch (error) {
      register.showError(error);
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
    'currency': currency,
    'exchange_rate': exchangeRate,
    'total_minor': cartTotal,
    'quote': cart.map((line) => line.quote(quoteConfig)).toList(),
    'expected_context': operatingContext,
  };
}
