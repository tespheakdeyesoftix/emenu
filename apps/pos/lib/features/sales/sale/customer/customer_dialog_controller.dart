import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import 'customer_directory.dart';

/// Dialog-local state; selecting a result is applied by the sales controller.
class CustomerDialogController extends GetxController {
  CustomerDialogController(this.directory);

  final CustomerDirectory directory;
  final searchInput = TextEditingController();
  final codeInput = TextEditingController();
  final scannerFocus = FocusNode();
  final term = ''.obs;
  final scanError = RxnString();

  List<Json> get results => directory.search(term.value);

  void searchChanged(String value) => term.value = value;

  Json? resolveCode(String code) {
    final matches = directory.matchingCode(code);
    if (matches.length == 1) {
      scanError.value = null;
      return matches.single;
    }
    scanError.value = matches.isEmpty
        ? 'customer_code_not_found'
        : 'customer_code_ambiguous';
    codeInput.selection = TextSelection(
      baseOffset: 0,
      extentOffset: codeInput.text.length,
    );
    if (scannerFocus.context != null) scannerFocus.requestFocus();
    return null;
  }

  @override
  void onClose() {
    searchInput.dispose();
    codeInput.dispose();
    scannerFocus.dispose();
    super.onClose();
  }
}
