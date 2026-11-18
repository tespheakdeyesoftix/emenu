import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../sale_controller.dart';
import 'widgets/product_catalog.dart';
import 'widgets/sale_cart.dart';

class SellView extends GetView<SaleController> {
  const SellView({super.key});

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: LayoutBuilder(
      builder: (context, box) => box.maxWidth >= 650
          ? _DesktopSale(availableWidth: box.maxWidth)
          : const _CompactSale(),
    ),
  );
}

class _DesktopSale extends GetView<SaleController> {
  const _DesktopSale({required this.availableWidth});

  final double availableWidth;

  @override
  Widget build(BuildContext context) => Obx(
    () => Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Expanded(child: ProductCatalog(showActionDock: true)),
        const VerticalDivider(width: 16, thickness: 1),
        SizedBox(
          key: const ValueKey('sale-order-panel'),
          width: controller.screenSettings.effectiveOrderWidth(availableWidth),
          child: const Padding(
            padding: EdgeInsetsDirectional.only(start: 4),
            child: SaleCart(),
          ),
        ),
      ],
    ),
  );
}

class _CompactSale extends StatelessWidget {
  const _CompactSale();

  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 2,
    child: Column(
      children: [
        TabBar(
          tabs: [
            Tab(text: 'sell'.tr),
            Tab(text: 'pay'.tr),
          ],
        ),
        const SizedBox(height: 8),
        const Expanded(
          child: TabBarView(children: [ProductCatalog(), SaleCart()]),
        ),
      ],
    ),
  );
}
