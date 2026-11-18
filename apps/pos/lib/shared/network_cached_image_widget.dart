import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

/// Displays a cached remote image with a consistent fallback.
class NetworkCachedImageWidget extends StatelessWidget {
  const NetworkCachedImageWidget({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.cacheWidth,
    this.label,
    this.fallback,
  });

  final String? imageUrl;
  final BoxFit fit;
  final int? cacheWidth;
  final String? label;
  final Widget? fallback;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final name = label?.trim() ?? '';
    final placeholder =
        fallback ??
        ExcludeSemantics(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [colors.surfaceContainerLow, colors.primaryContainer],
              ),
            ),
            child: Center(
              child: name.isEmpty
                  ? Icon(Icons.image_outlined, size: 30, color: colors.outline)
                  : FractionallySizedBox(
                      widthFactor: .48,
                      heightFactor: .6,
                      child: FittedBox(
                        child: Text(
                          name.characters.first,
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                color: colors.primary.withValues(alpha: .6),
                              ),
                        ),
                      ),
                    ),
            ),
          ),
        );
    final source = imageUrl?.trim() ?? '';
    final uri = Uri.tryParse(source);
    if (uri == null ||
        (uri.scheme != 'http' && uri.scheme != 'https') ||
        uri.host.isEmpty) {
      return placeholder;
    }

    return CachedNetworkImage(
      imageUrl: source,
      fit: fit,
      memCacheWidth: cacheWidth,
      fadeInDuration: const Duration(milliseconds: 150),
      placeholder: (_, _) => placeholder,
      errorWidget: (_, _, _) => placeholder,
    );
  }
}
