import 'package:flutter/material.dart';

import '../../../../shared/network_cached_image_widget.dart';
import '../../../../shared/app_theme.dart';

class CatalogFolderCard extends StatelessWidget {
  const CatalogFolderCard({
    super.key,
    required this.name,
    required this.onTap,
    this.imageUrl,
  });

  final String name;
  final VoidCallback onTap;
  final String? imageUrl;

  static double gridExtent(BuildContext context) =>
      (24 + MediaQuery.textScalerOf(context).scale(13) * 2.8).clamp(
        64,
        double.infinity,
      );

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final folder = Icon(Icons.folder_outlined, size: 28, color: colors.primary);
    return Tooltip(
      message: name,
      excludeFromSemantics: true,
      child: Card(
        margin: EdgeInsets.zero,
        color: AppColors.menuCard,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.cardOutline),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: Row(
              spacing: 8,
              children: [
                SizedBox.square(
                  dimension: 44,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: NetworkCachedImageWidget(
                      imageUrl: imageUrl,
                      cacheWidth: 160,
                      label: name,
                      fallback: Center(child: folder),
                    ),
                  ),
                ),
                Expanded(
                  child: Text(
                    name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium
                        ?.copyWith(fontSize: 13),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  size: 16,
                  color: colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
