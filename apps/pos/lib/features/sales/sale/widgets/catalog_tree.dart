import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../helpers/helper.dart';
import '../../sale_controller.dart';

class CatalogTree extends GetView<SaleController> {
  const CatalogTree({super.key, this.closeOnSelect = false});

  final bool closeOnSelect;

  @override
  Widget build(BuildContext context) => Obx(() {
    final navigation = controller.catalogNavigation;
    final rows = navigation.treeRows(controller.expandedSections.toSet());
    final pathIds = controller.sectionPath.map((node) => node['id']).toSet();
    final selectedId = rows
        .where((row) => pathIds.contains(row.node['id']))
        .lastOrNull
        ?.node['id'];
    void open(String? id) {
      controller.openSection(id);
      if (closeOnSelect) Navigator.pop(context);
    }

    return Material(
      type: MaterialType.transparency,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            dense: true,
            minTileHeight: 36,
            minVerticalPadding: 2,
            visualDensity: const VisualDensity(horizontal: -2, vertical: -2),
            contentPadding: const EdgeInsets.symmetric(horizontal: 6),
            minLeadingWidth: 16,
            horizontalTitleGap: 8,
            leading: const Icon(Icons.home_outlined, size: 18),
            title: Text(
              'catalog_home'.tr,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            selected: controller.section.value == controller.defaultSection,
            onTap: () => open(null),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: rows.length,
              itemBuilder: (context, index) {
                final row = rows[index];
                final id = row.node['id'] as String;
                final hasChildren =
                    row.depth == 0 && navigation.childrenOf(id).isNotEmpty;
                return Padding(
                  padding: EdgeInsetsDirectional.only(
                    start: row.depth == 0 ? 0 : 24,
                  ),
                  child: ListTile(
                    dense: true,
                    minTileHeight: 36,
                    minVerticalPadding: 2,
                    visualDensity: const VisualDensity(
                      horizontal: -2,
                      vertical: -2,
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 6),
                    minLeadingWidth: 16,
                    horizontalTitleGap: 8,
                    leading: row.depth == 0
                        ? const Icon(Icons.folder_outlined, size: 16)
                        : null,
                    selected: selectedId == id,
                    selectedTileColor: Theme.of(context)
                        .colorScheme
                        .primaryContainer,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    title: Text(
                      catalogLabel(row.node),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    onTap: () => open(id),
                    trailing: hasChildren
                        ? IconButton(
                            tooltip: catalogLabel(row.node),
                            constraints: const BoxConstraints(
                              minWidth: 32,
                              minHeight: 32,
                            ),
                            padding: EdgeInsets.zero,
                            onPressed: () => controller.toggleSection(id),
                            icon: Icon(
                              controller.expandedSections.contains(id)
                                  ? Icons.expand_less
                                  : Icons.expand_more,
                              size: 18,
                            ),
                          )
                        : null,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  });
}
