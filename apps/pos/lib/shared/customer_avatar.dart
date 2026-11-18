import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../features/customers/customer_service.dart';
import 'network_cached_image_widget.dart';

/// Customer photos share the same circular crop, cache, and missing-image state.
class CustomerAvatar extends StatelessWidget {
  const CustomerAvatar({
    super.key,
    this.customer,
    this.preview,
    this.size = 40,
  });

  final Json? customer;
  final Uint8List? preview;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final cacheWidth = (size * MediaQuery.devicePixelRatioOf(context)).ceil();
    final fallback = NetworkCachedImageWidget(
      imageUrl: customer?['photo'] as String?,
      cacheWidth: cacheWidth,
      fallback: ColoredBox(
        color: colors.primaryContainer,
        child: Center(
          child: Icon(
            Icons.person_outline,
            size: size * .6,
            color: colors.onPrimaryContainer,
          ),
        ),
      ),
    );
    final uploaded = customer?['has_uploaded_photo'];
    final id = customer?['id'];
    final future =
        preview == null &&
            (uploaded == 1 || uploaded == true) &&
            id is String &&
            Get.isRegistered<CustomerService>()
        ? Get.find<CustomerService>().photo(id)
        : null;

    Widget render(Uint8List? bytes) => bytes == null
        ? fallback
        : Image.memory(
            bytes,
            fit: BoxFit.cover,
            cacheWidth: cacheWidth,
            errorBuilder: (_, _, _) => fallback,
          );
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: ClipOval(
          child: future == null
              ? render(preview)
              : FutureBuilder(
                  key: ValueKey(id),
                  future: future,
                  builder: (_, snapshot) => render(snapshot.data),
                ),
        ),
      ),
    );
  }
}
