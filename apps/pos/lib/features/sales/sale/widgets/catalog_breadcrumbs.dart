import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../helpers/helper.dart';
import '../../sale_controller.dart';

class CatalogBreadcrumbs extends GetView<SaleController> {
  const CatalogBreadcrumbs({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final path = controller.sectionPath;
    return SizedBox(
      height: MediaQuery.textScalerOf(context).scale(18) + 18,
      child: Row(
        children: [
          IconButton(
            tooltip: 'catalog_up'.tr,
            onPressed: controller.canGoUp ? controller.goUp : null,
            icon: const Icon(Icons.arrow_upward),
            iconSize: 20,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            padding: const EdgeInsets.all(4),
          ),
          Expanded(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  TextButton(
                    style: TextButton.styleFrom(
                      minimumSize: const Size(32, 32),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                    ),
                    onPressed: () => controller.openSection(null),
                    child: Text('catalog_home'.tr),
                  ),
                  for (final node in path) ...[
                    const Icon(Icons.chevron_right, size: 18),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 180),
                      child: TextButton(
                        style: TextButton.styleFrom(
                          minimumSize: const Size(32, 32),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                        ),
                        onPressed: () =>
                            controller.openSection(node['id'] as String),
                        child: Text(
                          catalogLabel(node),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  });
}
