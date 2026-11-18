import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../helpers/helper.dart';
import '../../../../shared/customer_avatar.dart';

class CustomerListTile extends StatelessWidget {
  const CustomerListTile({
    super.key,
    required this.customer,
    required this.selected,
    required this.isDefault,
    required this.onTap,
  });

  final Json customer;
  final bool selected, isDefault;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final reference =
        (customer['customer_code'] ?? customer['external_reference'])
            ?.toString()
            .trim();
    return ListTile(
      selected: selected,
      selectedTileColor: Theme.of(context).colorScheme.primaryContainer,
      leading: CustomerAvatar(customer: customer),
      title: Text(catalogLabel(customer)),
      subtitle: reference != null && reference.isNotEmpty
          ? Text(reference)
          : null,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: 8,
        children: [
          if (isDefault)
            Tooltip(
              message: 'default_customer'.tr,
              child: const Icon(Icons.star_outline_rounded, size: 18),
            ),
          if (selected) const Icon(Icons.check_circle_rounded, size: 20),
        ],
      ),
      onTap: onTap,
    );
  }
}
