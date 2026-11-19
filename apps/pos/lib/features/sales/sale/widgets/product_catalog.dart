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
      final hasFolders = controller.service.catalogNodes.isNotEmpty;
      final layout = controller.screenSettings.layout;
      final left = layout == SaleScreenLayout.menuLeft;
      final sidebar = hasFolders && left && box.maxWidth >= 480;
      final content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 6,
        children: [
          if (hasFolders && layout == SaleScreenLayout.menuTop)
            const CatalogTopMenu(),
          if (hasFolders && left && !sidebar)
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
          Row(
            spacing: 8,
            children: [
              if (hasFolders)
                const Expanded(child: CatalogBreadcrumbs())
              else
                const Spacer(),
              const _ProductCardLayoutToggle(),
            ],
          ),
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

class _ProductCardLayoutToggle extends GetView<SaleController> {
  const _ProductCardLayoutToggle();

  @override
  Widget build(BuildContext context) => Obx(() {
    final colors = Theme.of(context).colorScheme;
    final switchToLeft =
        controller.productCardLayout.value == ProductCardLayout.imageTop;
    return IconButton.outlined(
      tooltip: (switchToLeft ? 'catalog_image_left' : 'catalog_image_top').tr,
      icon: Icon(
        switchToLeft
            ? Icons.vertical_split_outlined
            : Icons.horizontal_split_outlined,
      ),
      style: IconButton.styleFrom(
        minimumSize: const Size.square(32),
        padding: EdgeInsets.zero,
        iconSize: 17,
        foregroundColor: colors.onSurfaceVariant,
        side: BorderSide(color: colors.outlineVariant),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      onPressed: () => controller.productCardLayout.value = switchToLeft
          ? ProductCardLayout.imageLeft
          : ProductCardLayout.imageTop,
    );
  });
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
