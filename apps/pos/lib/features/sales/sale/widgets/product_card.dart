import 'package:flutter/material.dart';

import '../../../../shared/network_cached_image_widget.dart';
import '../../../../shared/app_theme.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({
    super.key,
    required this.name,
    required this.price,
    required this.onTap,
    this.code,
    this.imageUrl,
  });

  static const _photoHeight = 88.0;

  static double gridExtent(BuildContext context) {
    final textScale = MediaQuery.textScalerOf(context).scale(14) / 14;
    return _photoHeight + 20 + 76 * textScale.clamp(1.0, double.infinity);
  }

  final String name;
  final String price;
  final String? code;
  final String? imageUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final type = theme.textTheme;
    final productCode = code?.trim() ?? '';

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(6, 6, 6, 0),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(11),
                      child: SizedBox(
                        height: _photoHeight,
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            NetworkCachedImageWidget(
                              imageUrl: imageUrl,
                              cacheWidth: 480,
                              label: name,
                            ),
                            if (productCode.isNotEmpty)
                              Positioned(
                                top: 8,
                                left: 8,
                                right: 8,
                                child: Align(
                                  alignment: AlignmentDirectional.topStart,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 7,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: colors.surface.withValues(
                                        alpha: .9,
                                      ),
                                      borderRadius: BorderRadius.circular(7),
                                    ),
                                    child: Text(
                                      productCode,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: type.labelSmall?.copyWith(
                                        color: colors.onSurfaceVariant,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: type.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const Spacer(),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  price,
                                  style: type.titleMedium?.copyWith(
                                    color: colors.primary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                width: 27,
                                height: 27,
                                decoration: BoxDecoration(
                                  color: colors.primaryContainer,
                                  borderRadius: BorderRadius.circular(9),
                                ),
                                child: Icon(
                                  Icons.add_rounded,
                                  size: 18,
                                  color: colors.primary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
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
