import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/pos_api.dart';
import '../../core/bill_information.dart';
import '../../shared/forms/posting_date_picker.dart';
import '../../core/pricing.dart';
import '../../global.dart';
import '../../helpers/helper.dart';
import '../../ui/shared_widgets.dart';
import 'sale/cart_line.dart';
import 'sale/sale_service.dart';
import 'sale/cart_action.dart';
import 'sale/catalog_navigation.dart';
import 'sale/sale_screen_settings.dart';
import 'sale/widgets/sale_screen_setting_dialog_widget.dart';
import 'sale/widgets/payment_dialog.dart';
import 'sale/widgets/product_options_dialog.dart';
import 'sale/widgets/select_customer_dialog_widget.dart';
import 'sale/widgets/scan_memeber_card_dialog_widget.dart';
import 'sales_register.dart';

part 'methods.dart';
part 'table/methods.dart';
part 'sale/customer/customer_methods.dart';
part 'sale/bill_information_controller_methods.dart';

class SaleController extends GetxController {
  SaleController(this.service);

  final SaleService service;
  bool? salesHistoryCards;
  final search = TextEditingController();
  final term = ''.obs;
  final section = RxnString();
  final selectedLine = Rxn<CartLine>();
  final tablePickerVersion = 0.obs;
  final openingTable = false.obs;
  final expandedSections = <String>{}.obs;
  Timer? _searchDebounce;
  Worker? _navigation;
  Worker? _catalogUpdates;
  String? _lastDefaultSection;

  CatalogNavigation get catalogNavigation => service.catalogNavigation;
  SaleScreenSettings get screenSettings => service.screenSettings.value;
  List<Json> get sectionPath {
    final navigation = catalogNavigation;
    return navigation
        .pathTo(section.value)
        .where(
          (node) =>
              !navigation.restrictToRoot || node['id'] != navigation.rootId,
        )
        .toList();
  }

  List<Json> get visibleFolders => term.value.isEmpty
      ? catalogNavigation.childrenOf(section.value)
      : const [];

  String? get defaultSection {
    final id = service.rootMenuId;
    return service.restrictToDefaultMenu &&
            catalogNavigation.byId.containsKey(id)
        ? id
        : null;
  }

  bool get canGoUp =>
      section.value != null &&
      (!service.restrictToDefaultMenu || section.value != defaultSection);

  void openSection(String? id) {
    if (service.restrictToDefaultMenu) id ??= defaultSection;
    if (id != null && !catalogNavigation.byId.containsKey(id)) return;
    clearSearch();
    section.value = id;
    expandedSections.addAll(sectionPath.map((node) => node['id'] as String));
  }

  void toggleSection(String id) {
    if (!expandedSections.remove(id)) expandedSections.add(id);
  }

  void goUp() {
    final id = section.value;
    if (id != null && canGoUp) openSection(catalogNavigation.parentOf(id));
  }

  Future<void> reloadMenu() async {
    if (service.busy.value) return;
    if (await service.reloadMenu() && !isClosed) resetCatalog();
  }

  Future<void> openScreenSettings() async {
    if (service.busy.value) return;
    service.message.value = null;
    await Get.dialog<void>(
      SaleScreenSettingDialogWidget(
        initialSettings: screenSettings,
        save: service.saveScreenSettings,
        message: service.message,
      ),
      barrierDismissible: false,
    );
  }

  bool get showTablePlan =>
      service.tableMode != 'disabled' &&
      (service.tab.value == SalesRegister.tablesTab ||
          (service.tableMode == 'required' && service.tableId.value == null));

  List<Json> get visibleProducts =>
      service.filterProducts(term: term.value, section: section.value);

  @override
  void onInit() {
    super.onInit();
    resetCatalog();
    _catalogUpdates = ever(service.register.snapshot, (_) {
      final navigation = catalogNavigation;
      expandedSections.removeWhere((id) => !navigation.byId.containsKey(id));
      final rootChanged = _lastDefaultSection != defaultSection;
      _lastDefaultSection = defaultSection;
      if (rootChanged ||
          (service.restrictToDefaultMenu && section.value == null) ||
          (section.value != null &&
              !navigation.byId.containsKey(section.value))) {
        openSection(defaultSection);
      }
    });
    _navigation = ever(service.tab, (_) {
      resetCatalog();
      selectedLine.value = null;
    });
  }

  void searchChanged(String input) {
    _searchDebounce?.cancel();
    final next = input.trim().toLowerCase();
    if (next == term.value) return;
    _searchDebounce = Timer(const Duration(milliseconds: 700), () {
      term.value = next;
    });
  }

  Json? searchSubmitted(String input) {
    final product = service.productByCode(input);
    if (product != null) clearSearch();
    return product;
  }

  void clearSearch() {
    _searchDebounce?.cancel();
    search.clear();
    term.value = '';
  }

  void resetCatalog() {
    clearSearch();
    section.value = defaultSection;
    _lastDefaultSection = defaultSection;
    expandedSections.clear();
    expandedSections.addAll(sectionPath.map((node) => node['id'] as String));
  }

  void replaceLine(CartLine original, CartLine next) {
    final wasSelected = identical(original, selectedLine.value);
    final saved = service.replaceCartLine(original, next);
    if (saved != null && wasSelected) selectedLine.value = saved;
  }

  void selectLine(CartLine line) {
    selectedLine.value = identical(selectedLine.value, line) ? null : line;
  }

  @override
  void onClose() {
    _catalogUpdates?.dispose();
    _navigation?.dispose();
    _searchDebounce?.cancel();
    search.dispose();
    super.onClose();
  }
}
