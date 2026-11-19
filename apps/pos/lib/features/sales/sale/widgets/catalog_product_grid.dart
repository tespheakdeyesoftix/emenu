import 'dart:math';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
import '../../../../shared/empty_state_widget.dart';
import '../../sale_controller.dart';
import '../sale_screen_settings.dart';
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
    if (products.isEmpty && controller.term.value.isNotEmpty) {
      return Padding(
        padding: EdgeInsets.only(bottom: bottomPadding),
        child: Center(
          child: SingleChildScrollView(
            child: EmptyStateWidget(
              icon: Icons.search_off_outlined,
              title: 'catalog_no_matches'.tr,
              action: OutlinedButton(
                onPressed: controller.resetCatalog,
                child: Text('catalog_show_all'.tr),
              ),
            ),
          ),
        ),
      );
    }
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
      layout: controller.productCardLayout.value,
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
    required this.layout,
    required this.folders,
    required this.products,
    required this.emptyProducts,
    required this.bottomPadding,
  });

  final SaleController controller;
  final ProductCardLayout layout;
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
  bool _showBackToTop = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  void _onScroll() {
    final awayFromTop = _scroll.position.extentBefore > 0;
    if (awayFromTop != _showBackToTop) {
      setState(() => _showBackToTop = awayFromTop);
    }
    _maybeRevealMore();
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
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => Stack(
      fit: StackFit.expand,
      children: [
        _buildGrid(context, constraints.maxWidth),
        if (_showBackToTop)
          PositionedDirectional(
            end: 12,
            bottom: widget.bottomPadding + 12,
            child: FloatingActionButton.small(
              heroTag: null,
              tooltip: 'catalog_back_to_top'.tr,
              onPressed: () => _scroll.animateTo(
                _scroll.position.minScrollExtent,
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeOutCubic,
              ),
              child: const Icon(Icons.vertical_align_top_rounded),
            ),
          ),
      ],
    ),
  );

  Widget _buildGrid(BuildContext context, double width) {
    final folders = widget.folders;
    final products = widget.products;
    final controller = widget.controller;
    const gap = 8.0;
    final extent = ProductCard.gridExtent(context, widget.layout);
    final delegate = switch (widget.layout) {
      ProductCardLayout.imageTop => SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 208,
        mainAxisExtent: extent,
        crossAxisSpacing: gap,
        mainAxisSpacing: gap,
      ),
      ProductCardLayout.imageLeft => SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: max(1, ((width + gap) / 240).floor()),
        mainAxisExtent: extent,
        crossAxisSpacing: gap,
        mainAxisSpacing: gap,
      ),
    };
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
            Obx(() {
              final quantities = <String, num>{};
              for (final line in controller.service.cart) {
                if (line.voided) continue;
                final id = line.product['id'] as String;
                quantities[id] = (quantities[id] ?? 0) + line.quantity;
              }
              final currency = controller.service.currency;
              return SliverGrid.builder(
                gridDelegate: delegate,
                itemCount: min(_limit, products.length),
                itemBuilder: (context, index) {
                  final product = products[index];
                  return ProductCard(
                    key: ValueKey('catalog-product-${product['id']}'),
                    layout: widget.layout,
                    name: catalogLabel(product),
                    code: product['code']?.toString(),
                    imageUrl: product['image_url']?.toString(),
                    price: displayAmount(product['price_minor'] as int, currency),
                    orderedQuantity: normalizedQuantity(quantities[product['id']] ?? 0),
                    onTap: () => controller.addProduct(context, product),
                  );
                },
              );
            }),
          if (widget.emptyProducts case final empty?)
            SliverToBoxAdapter(child: empty),
          if (widget.bottomPadding > 0)
            SliverToBoxAdapter(child: SizedBox(height: widget.bottomPadding)),
        ],
      ),
    );
  }
}
