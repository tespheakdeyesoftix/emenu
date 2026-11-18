import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../helpers/helper.dart';
import '../../../../shared/app_theme.dart';
import '../../../../shared/customer_avatar.dart';
import '../../../customers/customer_controller.dart';
import '../../sale_controller.dart';

class CartCustomer extends GetView<SaleController> {
  const CartCustomer({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final customer = service.selectedCustomer;
    final editor = Get.isRegistered<CustomerController>()
        ? Get.find<CustomerController>()
        : null;
    return Material(
      color: AppColors.card,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: AppColors.cardOutline),
        borderRadius: BorderRadius.circular(14),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              key: const ValueKey('cart-customer-picker'),
              onTap: service.cartEditable
                  ? () => controller.chooseCustomer(context)
                  : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Row(
                  spacing: 8,
                  children: [
                    CustomerAvatar(customer: customer, size: 30),
                    Expanded(
                      child: _CustomerIdentity(
                        name: customer == null
                            ? 'default_customer'.tr
                            : catalogLabel(customer),
                        reference:
                            (customer?['customer_code'] ??
                                    customer?['external_reference'])
                                ?.toString()
                                .trim(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _CustomerAction(
                  icon: Icons.add_rounded,
                  tooltip: 'add_customer',
                  onPressed:
                      editor != null &&
                          service.cartEditable &&
                          editor.service.canWrite
                      ? () async {
                          final saved = await editor.edit(context);
                          final id = saved?['id'];
                          if (context.mounted && id is String) {
                            service.selectCustomer(id);
                          }
                        }
                      : null,
                ),
                _CustomerAction(
                  icon: Icons.qr_code_scanner_rounded,
                  tooltip: 'scan_customer',
                  onPressed: service.cartEditable
                      ? () => controller.scanCustomer(context)
                      : null,
                ),
                if (service.hasCustomCustomer)
                  _CustomerAction(
                    icon: Icons.close_rounded,
                    tooltip: 'reset_customer',
                    onPressed: service.cartEditable
                        ? () => service.selectCustomer(null)
                        : null,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  });
}

class _CustomerIdentity extends StatelessWidget {
  const _CustomerIdentity({required this.name, this.reference});

  final String name;
  final String? reference;

  @override
  Widget build(BuildContext context) {
    final type = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'customer'.tr,
          style: type.bodySmall?.copyWith(color: AppColors.cardMuted),
        ),
        Text(
          name,
          style: type.titleSmall,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (reference != null && reference!.isNotEmpty)
          Text(
            reference!,
            style: type.bodySmall,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }
}

class _CustomerAction extends StatelessWidget {
  const _CustomerAction({
    required this.icon,
    required this.tooltip,
    this.onPressed,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: tooltip.tr,
    onPressed: onPressed,
    icon: Icon(icon, size: 19),
    padding: const EdgeInsets.all(8),
    constraints: const BoxConstraints(minWidth: 36, minHeight: 40),
    visualDensity: VisualDensity.compact,
  );
}
