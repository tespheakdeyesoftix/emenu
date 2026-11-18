import 'dart:math';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
import '../../../../shared/empty_state_widget.dart';
import '../../sale_controller.dart';
import 'catalog_folder_card.dart';
import 'product_card.dart';

class CatalogProductGrid extends GetView<SaleController> {
  const CatalogProductGrid({super.key, this.bottomPadding = 0});

  final double bottomPadding;

  @override
  Widget build(BuildContext context) => Obx(() {
    final scope = (controller.section.value, controller.term.value);
    final folders = controller.visibleFolders;
    final products = controller.visibleProducts;
    final emptyProducts = products.isEmpty
        ? EmptyStateWidget(
            icon: Icons.inventory_2_outlined,
            title: 'catalog_empty'.tr,
            description:
                (controller.service.catalogMenuIssue ?? 'catalog_empty_detail')
                    .tr,
          )
        : null;
    if (folders.isEmpty && emptyProducts != null) return emptyProducts;
    return _PagedCatalogGrid(
      key: ValueKey(scope),
      controller: controller,
      folders: folders,
      products: products,
      emptyProducts: emptyProducts,
      bottomPadding: bottomPadding,
    );
  });
}

class _PagedCatalogGrid extends StatefulWidget {
  const _PagedCatalogGrid({
    super.key,
    required this.controller,
    required this.folders,
    required this.products,
    required this.emptyProducts,
    required this.bottomPadding,
  });

  final SaleController controller;
  final List<Json> folders;
  final List<Json> products;
  final Widget? emptyProducts;
  final double bottomPadding;

  @override
  State<_PagedCatalogGrid> createState() => _PagedCatalogGridState();
}

class _PagedCatalogGridState extends State<_PagedCatalogGrid> {
  static const _pageSize = 50;
  static const _prefetchDistance = 320;
  final _scroll = ScrollController(keepScrollOffset: false);
  int _limit = _pageSize;
  bool _pageScheduled = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_maybeRevealMore);
  }

  void _maybeRevealMore() {
    if (_pageScheduled || !_canRevealMore) return;
    _pageScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _pageScheduled = false;
      if (mounted && _canRevealMore) setState(() => _limit += _pageSize);
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  bool get _canRevealMore =>
      _limit < widget.products.length &&
      _scroll.hasClients &&
      _scroll.position.hasContentDimensions &&
      _scroll.position.extentAfter <= _prefetchDistance;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final folders = widget.folders;
    final products = widget.products;
    final controller = widget.controller;
    return NotificationListener<ScrollMetricsNotification>(
      onNotification: (notification) {
        // A large viewport can fit the first batch without a way to scroll.
        if (notification.depth == 0 &&
            notification.metrics.maxScrollExtent ==
                notification.metrics.minScrollExtent) {
          _maybeRevealMore();
        }
        return false;
      },
      child: CustomScrollView(
        key: const ValueKey('catalog-product-grid'),
        controller: _scroll,
        slivers: [
          if (folders.isNotEmpty)
            SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 240,
                mainAxisExtent: CatalogFolderCard.gridExtent(context),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: folders.length,
              itemBuilder: (context, index) {
                final node = folders[index];
                return CatalogFolderCard(
                  key: ValueKey('catalog-folder-${node['id']}'),
                  name: catalogLabel(node),
                  imageUrl: node['image_url'] as String?,
                  onTap: () => controller.openSection(node['id'] as String),
                );
              },
            ),
          if (folders.isNotEmpty && products.isNotEmpty)
            const SliverToBoxAdapter(child: SizedBox(height: 8)),
          if (products.isNotEmpty)
            SliverGrid.builder(
              gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 208,
                mainAxisExtent: ProductCard.gridExtent(context),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: min(_limit, products.length),
              itemBuilder: (context, index) {
                final product = products[index];
                return ProductCard(
                  key: ValueKey('catalog-product-${product['id']}'),
                  name: catalogLabel(product),
                  code: product['code']?.toString(),
                  imageUrl: product['image_url']?.toString(),
                  price: displayAmount(
                    product['price_minor'] as int,
                    controller.service.currency,
                  ),
                  onTap: () => controller.addProduct(context, product),
                );
              },
            ),
          if (widget.emptyProducts case final empty?)
            SliverToBoxAdapter(child: empty),
          if (widget.bottomPadding > 0)
            SliverToBoxAdapter(child: SizedBox(height: widget.bottomPadding)),
        ],
      ),
    );
  }
}
