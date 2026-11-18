import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../shared/forms/search_input_field.dart';

import 'sale/sell_view.dart';
import 'sale/widgets/sale_screen_settings_menu.dart';
import 'sale_controller.dart';
import 'table/table_plan_view.dart';

typedef SaleLayout = Widget Function(
  Widget body, {
  Widget? search,
  Widget? trailing,
});

/// The sales entry point hosts either the table plan or the current sale.
class SaleScreen extends GetView<SaleController> {
  const SaleScreen({super.key, required this.layout});

  final SaleLayout layout;

  @override
  Widget build(BuildContext context) => Obx(
    () => controller.showTablePlan
        ? layout(
            const TablePlanView(),
            trailing: const SaleScreenSettingsMenu(),
          )
        : layout(
            const SellView(),
            trailing: const SaleScreenSettingsMenu(),
            search: SearchInputField(
              controller: controller.search,
              onChanged: controller.searchChanged,
              onSubmitted: (input) {
                final product = controller.searchSubmitted(input);
                if (product != null) controller.addProduct(context, product);
              },
            ),
          ),
  );
}
