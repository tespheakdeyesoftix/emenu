import 'package:flutter/material.dart';

import '../../../../shared/app_theme.dart';
import '../../../../shared/network_cached_image_widget.dart';
import '../sale_screen_settings.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    required this.price,
    required this.onTap,
    this.code,
    this.imageUrl,
    this.layout = ProductCardLayout.imageTop,
  });

  static const _photoHeight = 88.0;
  static const _sidePhotoSize = 76.0;

  static double gridExtent(
    BuildContext context, [
    ProductCardLayout layout = ProductCardLayout.imageTop,
  ]) {
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
    final scale = textScale.clamp(1.0, double.infinity);
    return switch (layout) {
      ProductCardLayout.imageTop => _photoHeight + 20 + 76 * scale,
      ProductCardLayout.imageLeft => 20 + 92 * scale,
    };
  }

  final String name;
  final String price;
  final String? code;
  final String? imageUrl;
  final VoidCallback onTap;
  final ProductCardLayout layout;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final type = theme.textTheme;
    final productCode = code?.trim() ?? '';
    final imageLeft = layout == ProductCardLayout.imageLeft;
    final codeStyle = type.labelSmall?.copyWith(color: colors.onSurfaceVariant);
    final photo = ClipRRect(
      borderRadius: BorderRadius.circular(11),
      child: Stack(
        fit: StackFit.expand,
        children: [
          NetworkCachedImageWidget(
            imageUrl: imageUrl,
            cacheWidth: imageLeft ? 240 : 480,
            label: name,
          ),
          if (!imageLeft && productCode.isNotEmpty)
            PositionedDirectional(
              top: 8,
              start: 8,
              end: 8,
              child: Align(
                alignment: AlignmentDirectional.topStart,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: .9),
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    productCode,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: codeStyle,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
    final details = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (imageLeft && productCode.isNotEmpty)
          Text(
            productCode,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: codeStyle,
          ),
        Text(
          name,
          style: type.titleSmall?.copyWith(fontWeight: FontWeight.w600),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const Spacer(),
        Text(
          price,
          style: type.titleMedium?.copyWith(
            color: colors.primary,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );

    return MergeSemantics(
      child: Semantics(
        button: true,
        child: Card(
          margin: EdgeInsets.zero,
          color: AppColors.card,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: AppColors.cardOutline),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (imageLeft)
                Padding(
                  padding: const EdgeInsets.all(8),
                  child: Row(
                    spacing: 10,
                    children: [
                      SizedBox.square(dimension: _sidePhotoSize, child: photo),
                      Expanded(child: details),
                    ],
                  ),
                )
              else
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(6, 6, 6, 0),
                      child: SizedBox(height: _photoHeight, child: photo),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                        child: details,
                      ),
                    ),
                  ],
                ),
              Material(
                type: MaterialType.transparency,
                child: InkWell(onTap: onTap),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
