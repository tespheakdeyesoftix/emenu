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
    String field(String key) => customer[key]?.toString().trim() ?? '';
    bool enabled(String key) => customer[key] == true || customer[key] == 1;
    final code = field('customer_code');
    final reference = code.isEmpty ? field('external_reference') : code;
    final phone = field('phone_number');
    final email = field('email');
    final gender = field('gender');
    final details = [
      if (reference.isNotEmpty) (Icons.tag, reference),
      if (gender.isNotEmpty)
        (
          Icons.person_outline,
          switch (gender.toLowerCase()) {
            'male' => 'customer_male'.tr,
            'female' => 'customer_female'.tr,
            _ => gender,
          },
        ),
      if (phone.isNotEmpty) (Icons.phone_outlined, phone),
      if (email.isNotEmpty) (Icons.mail_outline, email),
    ];
    final flags = [
      if (enabled('is_membership'))
        (Icons.card_membership_outlined, 'customer_membership'.tr),
      if (enabled('allow_credit'))
        (Icons.credit_card_outlined, 'customer_allow_credit'.tr),
    ];
    return ListTile(
      selected: selected,
      selectedTileColor: Theme.of(context).colorScheme.primaryContainer,
      leading: CustomerAvatar(customer: customer),
      title: Text(catalogLabel(customer)),
      subtitle: details.isEmpty && flags.isEmpty
          ? null
          : Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 6,
                children: [
                  if (details.isNotEmpty)
                    Wrap(
                      spacing: 12,
                      runSpacing: 3,
                      children: [
                        for (final (icon, value) in details)
                          _CustomerDetail(icon: icon, value: value),
                      ],
                    ),
                  if (flags.isNotEmpty)
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        for (final (icon, value) in flags)
                          DecoratedBox(
                            decoration: ShapeDecoration(
                              shape: const StadiumBorder(),
                              color: Theme.of(context)
                                  .colorScheme
                                  .surfaceContainerHigh,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 2,
                              ),
                              child: _CustomerDetail(icon: icon, value: value),
                            ),
                          ),
                      ],
                    ),
                ],
              ),
            ),
      trailing: !isDefault && !selected
          ? null
          : Row(
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

class _CustomerDetail extends StatelessWidget {
  const _CustomerDetail({required this.icon, required this.value});

  final IconData icon;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = theme.colorScheme.onSurfaceVariant;
    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 4,
      children: [
        Icon(icon, size: 14, color: color),
        Flexible(
          child: Text(
            value,
            style: theme.textTheme.bodySmall?.copyWith(color: color),
          ),
        ),
      ],
    );
  }
}
