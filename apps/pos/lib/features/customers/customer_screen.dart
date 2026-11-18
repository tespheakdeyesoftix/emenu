import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../helpers/helper.dart';
import '../../shared/customer_avatar.dart';
import '../../shared/empty_state_widget.dart';
import '../../shared/forms/customer_search_field.dart';
import 'customer_controller.dart';

class CustomerScreen extends GetView<CustomerController> {
  const CustomerScreen({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final rows = controller.customers;
    final editable = controller.service.canWrite;
    final refreshing = controller.refreshing.value;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            spacing: 8,
            children: [
              Expanded(
                child: CustomerSearchField(
                  controller: controller.search,
                  autofocus: false,
                  hint: 'customer_directory_search',
                  onChanged: (value) => controller.term.value = value,
                ),
              ),
              IconButton(
                tooltip: 'refresh'.tr,
                icon: const Icon(Icons.refresh),
                onPressed: refreshing ? null : controller.reload,
              ),
              if (editable)
                IconButton.filled(
                  tooltip: 'add_customer'.tr,
                  onPressed: () => controller.edit(context),
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                ),
            ],
          ),
        ),
        if (refreshing) const LinearProgressIndicator(),
        const Divider(height: 1),
        Expanded(
          child: rows.isEmpty
              ? SingleChildScrollView(
                  child: EmptyStateWidget(
                    icon: Icons.person_search_outlined,
                    title: 'customer_no_results'.tr,
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: rows.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final customer = rows[index];
                    final details =
                        [
                              if (customer['is_walk_in'] == 1 ||
                                  customer['is_walk_in'] == true)
                                'customer_walk_in'.tr,
                              customer['customer_group_name'],
                              customer['phone_number'],
                              customer['email'],
                              customer['customer_code'],
                              customer['external_reference'],
                            ]
                            .whereType<String>()
                            .where((value) => value.isNotEmpty)
                            .join(' · ');
                    return ListTile(
                      key: ValueKey(customer['id']),
                      leading: CustomerAvatar(customer: customer),
                      title: Text(catalogLabel(customer)),
                      subtitle: details.isEmpty
                          ? null
                          : Text(
                              details,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => controller.edit(context, customer: customer),
                    );
                  },
                ),
        ),
      ],
    );
  });
}
