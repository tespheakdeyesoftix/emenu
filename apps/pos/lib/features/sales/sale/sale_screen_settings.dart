enum SaleScreenLayout {
  menuTop('menu_top'),
  menuLeft('menu_left'),
  browsable('browsable');

  const SaleScreenLayout(this.key);

  final String key;
}

class SaleScreenSettings {
  const SaleScreenSettings({
    this.layout = SaleScreenLayout.menuTop,
    this.orderProductListWidth = defaultWidth,
    this.catalogWidth = defaultCatalogWidth,
  });

  static const minWidth = 280;
  static const maxWidth = 600;
  static const defaultWidth = 350;
  static const minCatalogWidth = 160;
  static const maxCatalogWidth = 360;
  static const defaultCatalogWidth = 200;

  final SaleScreenLayout layout;
  final int orderProductListWidth;
  final int catalogWidth;

  factory SaleScreenSettings.fromJson(Map<String, dynamic>? data) {
    final width = data?['order_product_list_width'];
    final catalogWidth = data?['catalog_width'];
    return SaleScreenSettings(
      layout:
          SaleScreenLayout.values
              .where((layout) => layout.key == data?['sell_screen_layout'])
              .firstOrNull ??
          SaleScreenLayout.menuTop,
      orderProductListWidth:
          width is int && width >= minWidth && width <= maxWidth
          ? width
          : defaultWidth,
      catalogWidth:
          catalogWidth is int &&
              catalogWidth >= minCatalogWidth &&
              catalogWidth <= maxCatalogWidth
          ? catalogWidth
          : defaultCatalogWidth,
    );
  }

  bool get validOrderWidth =>
      orderProductListWidth >= minWidth && orderProductListWidth <= maxWidth;

  bool get validCatalogWidth =>
      catalogWidth >= minCatalogWidth && catalogWidth <= maxCatalogWidth;

  bool get valid => validOrderWidth && validCatalogWidth;

  double effectiveOrderWidth(double availableWidth) => orderProductListWidth
      .toDouble()
      .clamp(minWidth.toDouble(), (availableWidth - 296).clamp(280.0, 600.0));

  double effectiveCatalogWidth(double availableWidth) =>
      catalogWidth.toDouble().clamp(
        minCatalogWidth.toDouble(),
        (availableWidth - 300).clamp(
          minCatalogWidth.toDouble(),
          maxCatalogWidth.toDouble(),
        ),
      );
}
