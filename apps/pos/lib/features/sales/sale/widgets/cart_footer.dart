import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../sale_controller.dart';

class CartFooter extends GetView<SaleController> {
  const CartFooter({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final total = service.cartPreviewTotal;
    final quantity = normalizedQuantity(
      service.cart.fold<num>(0, (sum, line) => sum + line.quantity),
    );
    final currency = service.currency;
    String? secondary;
    try {
      secondary = displayAmount(
        primaryToSecondary(total, currency, service.exchangeRate),
        currency == 'USD' ? 'KHR' : 'USD',
      );
    } on FormatException {
      // Keep the primary amount available if the alternate currency is invalid.
    }
    final canSubmit = service.canSubmit;
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.primary,
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          _CartTotals(
            total: displayAmount(total, currency),
            secondary: secondary,
            quantity: quantity,
          ),
          _CartCheckoutActions(
            onPay: canSubmit && service.cart.isNotEmpty
                ? () => controller.pay(context, total)
                : null,
            onSubmit: canSubmit ? () => controller.submitOrder(context) : null,
          ),
        ],
      ),
    );
  });
}

class _CartTotals extends StatelessWidget {
  const _CartTotals({
    required this.total,
    required this.secondary,
    required this.quantity,
  });

  final String total;
  final String? secondary;
  final num quantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onPrimary.withValues(alpha: .78),
      height: 1.4,
    );
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      spacing: 12,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 2,
            children: [
              Text(
                'total'.tr,
                style: theme.textTheme.titleMedium?.copyWith(
                  color: theme.colorScheme.onPrimary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text('${'cart_total_quantity'.tr} · $quantity', style: muted),
            ],
          ),
        ),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 2,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerEnd,
                child: Text(
                  total,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontSize: 26,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onPrimary,
                  ),
                ),
              ),
              if (secondary != null)
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: AlignmentDirectional.centerEnd,
                  child: Text(secondary!, style: muted),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CartCheckoutActions extends StatelessWidget {
  const _CartCheckoutActions({this.onPay, this.onSubmit});

  final VoidCallback? onPay, onSubmit;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final ink = colors.onPrimary;
    ButtonStyle actionStyle({required bool primary}) => FilledButton.styleFrom(
      foregroundColor: primary ? colors.primary : ink,
      backgroundColor: primary ? ink : ink.withValues(alpha: .14),
      side: primary
          ? null
          : BorderSide(color: ink.withValues(alpha: onSubmit == null ? .12 : .38)),
      disabledForegroundColor: ink.withValues(alpha: .48),
      disabledBackgroundColor: ink.withValues(alpha: .08),
      minimumSize: const Size(48, 48),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: FilledButton.icon(
            style: actionStyle(primary: true),
            onPressed: onPay,
            icon: const Icon(Icons.payments_outlined, size: 20),
            label: Text('pay'.tr),
          ),
        ),
        Expanded(
          child: FilledButton.tonalIcon(
            style: actionStyle(primary: false),
            onPressed: onSubmit,
            icon: const Icon(Icons.send_rounded, size: 18),
            label: Text('cart_submit'.tr),
          ),
        ),
      ],
    );
  }
}
