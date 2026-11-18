import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/pos_api.dart';
import 'customer_service.dart';
import 'widgets/add_customer_dialog_widget.dart';

class CustomerController extends GetxController {
  CustomerController(this.service);

  final CustomerService service;
  final search = TextEditingController();
  final term = ''.obs;
  final refreshing = false.obs;

  List<Json> get customers => service.directory.search(term.value);

  Future<void> reload() async {
    if (refreshing.value) return;
    refreshing.value = true;
    try {
      await service.refresh();
    } finally {
      refreshing.value = false;
    }
  }

  Future<Json?> edit(BuildContext context, {Json? customer}) {
    if (customer == null && !service.canWrite) return Future.value();
    return showDialog<Json>(
      context: context,
      barrierDismissible: false,
      builder: (_) =>
          AddCustomerDialogWidget(service: service, customer: customer),
    );
  }

  @override
  void onClose() {
    search.dispose();
    super.onClose();
  }
}
