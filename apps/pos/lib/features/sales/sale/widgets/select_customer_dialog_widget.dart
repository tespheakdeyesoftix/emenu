import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../shared/empty_state_widget.dart';
import '../../../../shared/forms/customer_search_field.dart';
import '../customer/customer_dialog_controller.dart';
import '../customer/customer_directory.dart';
import 'customer_dialog_header.dart';
import 'customer_list_tile.dart';

class SelectCustomerDialogWidget extends StatefulWidget {
  const SelectCustomerDialogWidget({
    super.key,
    required this.directory,
    this.selectedId,
    this.defaultId,
  });

  final CustomerDirectory directory;
  final String? selectedId, defaultId;

  @override
  State<SelectCustomerDialogWidget> createState() =>
      _SelectCustomerDialogState();
}

class _SelectCustomerDialogState extends State<SelectCustomerDialogWidget> {
  late final controller = CustomerDialogController(widget.directory);

  @override
  void dispose() {
    controller.onClose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Dialog(
    insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480, maxHeight: 560),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const CustomerDialogHeader(
            title: 'select_customer',
            icon: Icons.people_outline,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: CustomerSearchField(
              controller: controller.searchInput,
              onChanged: controller.searchChanged,
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: Obx(() {
              final customers = controller.results;
              if (customers.isEmpty) {
                return SingleChildScrollView(
                  child: EmptyStateWidget(
                    icon: Icons.person_search_outlined,
                    title: 'customer_no_results'.tr,
                  ),
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 6),
                itemCount: customers.length,
                separatorBuilder: (_, _) =>
                    const Divider(height: 1, indent: 56, endIndent: 16),
                itemBuilder: (context, index) {
                  final customer = customers[index];
                  return CustomerListTile(
                    customer: customer,
                    selected: customer['id'] == widget.selectedId,
                    isDefault: customer['id'] == widget.defaultId,
                    onTap: () =>
                        Navigator.pop(context, customer['id'] as String),
                  );
                },
              );
            }),
          ),
        ],
      ),
    ),
  );
}
