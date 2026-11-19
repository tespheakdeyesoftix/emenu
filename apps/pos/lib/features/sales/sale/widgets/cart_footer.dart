import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../sale_controller.dart';

class CartFooter extends GetView<SaleController> {
  const CartFooter({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final total = service.cartTotal;
    final quantity = service.cart.fold(0, (sum, line) => sum + line.quantity);
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
    return Padding(
      padding: const EdgeInsets.fromLTRB(2, 0, 2, 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 10,
        children: [
          const Divider(height: 1),
          _CartTotals(
            total: displayAmount(total, currency),
            secondary: secondary,
            quantity: quantity,
          ),
          _CartCheckoutActions(
            onPay: canSubmit ? () => controller.pay(context, total) : null,
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
  final int quantity;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
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
                    fontSize: 24,
                    height: 1.2,
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.primary,
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
    final style = FilledButton.styleFrom(
      minimumSize: const Size(48, 48),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    return Row(
      spacing: 8,
      children: [
        Expanded(
          child: FilledButton.icon(
            style: style,
            onPressed: onPay,
            icon: const Icon(Icons.payments_outlined, size: 20),
            label: Text('pay'.tr),
          ),
        ),
        Expanded(
          child: FilledButton.tonalIcon(
            style: style,
            onPressed: onSubmit,
            icon: const Icon(Icons.send_rounded, size: 18),
            label: Text('cart_submit'.tr),
          ),
        ),
      ],
    );
  }
}
