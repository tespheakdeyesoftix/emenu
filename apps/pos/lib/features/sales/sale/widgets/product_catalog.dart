import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';
import '../sale_screen_settings.dart';
import 'catalog_breadcrumbs.dart';
import 'catalog_product_grid.dart';
import 'catalog_top_menu.dart';
import 'catalog_tree.dart';
import 'desktop_sale_action_widget.dart';

class ProductCatalog extends GetView<SaleController> {
  const ProductCatalog({super.key, this.showActionDock = false});

  final bool showActionDock;

  void _openTree(BuildContext context) => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SizedBox(
      height: MediaQuery.sizeOf(context).height * .65,
      child: const SafeArea(child: CatalogTree(closeOnSelect: true)),
    ),
  );

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) => Obx(() {
      if (controller.service.catalogNodes.isEmpty) {
        return _CatalogProductList(showActionDock: showActionDock);
      }
      final layout = controller.screenSettings.layout;
      final left = layout == SaleScreenLayout.menuLeft;
      final sidebar = left && box.maxWidth >= 480;
      final content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 6,
        children: [
          if (layout == SaleScreenLayout.menuTop) const CatalogTopMenu(),
          if (left && !sidebar)
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: TextButton.icon(
                key: const ValueKey('catalog-open-tree'),
                onPressed: () => _openTree(context),
                icon: const Icon(Icons.account_tree_outlined),
                label: Text(
                  (controller.catalogNavigation.mode == 'menu'
                          ? 'catalog_menus'
                          : 'catalog_categories')
                      .tr,
                ),
              ),
            ),
          const CatalogBreadcrumbs(),
          Expanded(child: _CatalogProductList(showActionDock: showActionDock)),
        ],
      );
      return sidebar
          ? Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  key: const ValueKey('catalog-left-tree'),
                  width: controller.screenSettings.effectiveCatalogWidth(
                    box.maxWidth,
                  ),
                  child: const CatalogTree(),
                ),
                const VerticalDivider(width: 12, thickness: 1),
                Expanded(child: content),
              ],
            )
          : content;
    }),
  );
}

class _CatalogProductList extends StatelessWidget {
  const _CatalogProductList({required this.showActionDock});

  final bool showActionDock;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      CatalogProductGrid(bottomPadding: showActionDock ? 96 : 0),
      if (showActionDock)
        const Positioned(
          left: 8,
          right: 8,
          bottom: 12,
          child: SafeArea(top: false, child: DesktopSaleActionWidget()),
        ),
    ],
  );
}
