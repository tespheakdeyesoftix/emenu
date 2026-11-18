import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pricing.dart';
import '../../../../shared/app_theme.dart';

class CartSummary extends StatelessWidget {
  const CartSummary({
    super.key,
    required this.amounts,
    required this.taxRule,
    required this.currency,
  });

  final List<BillTotals> amounts;
  final Map? taxRule;
  final String currency;

  @override
  Widget build(BuildContext context) {
    int sum(int Function(BillTotals) amount) =>
        amounts.fold(0, (total, row) => total + amount(row));
    final taxes = [
      sum((row) => row.tax1),
      sum((row) => row.tax2),
      sum((row) => row.tax3),
    ];
    final discount = sum((row) => row.discount);
    String taxLabel(int index) {
      final name = (taxRule?['tax_${index + 1}_name'] as String?)?.trim();
      return name == null || name.isEmpty ? 'cart_tax_level'.tr : name;
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 2,
          children: [
            CartAmount(
              label: 'cart_subtotal'.tr,
              amount: displayAmount(sum((row) => row.subtotal), currency),
            ),
            if (discount != 0)
              CartAmount(
                label: 'cart_discount'.tr,
                amount: displayAmount(-discount, currency),
              ),
            for (final (index, tax) in taxes.indexed)
              if (tax != 0)
                CartAmount(
                  label: taxLabel(index),
                  amount: displayAmount(tax, currency),
                ),
          ],
        ),
      ),
    );
  }
}

class CartAmount extends StatelessWidget {
  const CartAmount({
    super.key,
    required this.label,
    required this.amount,
    this.prominent = false,
  });

  final String label;
  final String amount;
  final bool prominent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final style = prominent
        ? theme.textTheme.titleLarge?.copyWith(
            fontSize: 23,
            color: theme.colorScheme.primary,
          )
        : theme.textTheme.bodySmall?.copyWith(color: AppColors.cardMuted);
    return Row(
      spacing: 8,
      children: [
        Expanded(child: Text(label, style: style)),
        if (amount.isNotEmpty)
          Expanded(
            child: Text(
              amount,
              textAlign: TextAlign.end,
              style: style?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}
