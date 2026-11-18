import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';
import 'cart_footer.dart';
import 'cart_header.dart';
import 'cart_item_actions.dart';
import 'cart_item_row.dart';
import 'cart_summary.dart';
import '../../../../shared/empty_state_widget.dart';

class SaleCart extends GetView<SaleController> {
  const SaleCart({super.key});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, layout) => Obx(() {
      final service = controller.service;
      final lines = service.cart.toList();
      final totals = lines.map(service.totalOf).toList();
      final summary = CartSummary(
        amounts: totals,
        taxRule: service.quoteConfig['default_tax_rule'] as Map?,
        currency: service.currency,
      );
      final compact =
          layout.maxHeight < 520 ||
          MediaQuery.textScalerOf(context).scale(14) > 18;
      final rowOffset = compact ? 1 : 0;
      final empty = lines.isEmpty;
      final rowCount = empty ? 1 : lines.length;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          if (!compact) const CartHeader(),
          Expanded(
            child: ListView.builder(
              itemCount: rowCount + (compact ? 2 : 0),
              itemBuilder: (context, index) {
                if (compact && index == 0) {
                  return const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: CartHeader(),
                  );
                }
                final item = index - rowOffset;
                if (item == rowCount) return summary;
                if (empty) {
                  return EmptyStateWidget(
                    icon: Icons.shopping_bag_outlined,
                    title: 'cart_empty'.tr,
                    description: 'cart_empty_detail'.tr,
                  );
                }
                final line = lines[item];
                return Obx(() {
                  final active = identical(controller.selectedLine.value, line);
                  return CartItemRow(
                    line: line,
                    total: totals[item].total,
                    currency: service.currency,
                    selected: active,
                    onSelect: () => controller.selectLine(line),
                    actions: active ? CartItemActions(line: line) : null,
                  );
                });
              },
            ),
          ),
          if (!compact) summary,
          const CartFooter(),
        ],
      );
    }),
  );
}
