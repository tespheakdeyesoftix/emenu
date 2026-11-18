import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../helpers/helper.dart';
import '../../sale_controller.dart';

class CatalogTopMenu extends GetView<SaleController> {
  const CatalogTopMenu({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final navigation = controller.catalogNavigation;
    final path = controller.sectionPath;
    return _MenuStrip(
      nodes: navigation.navigationRoots,
      selected: path.firstOrNull?['id'] as String?,
      home: true,
      open: controller.openSection,
    );
  });
}

class _MenuStrip extends StatelessWidget {
  const _MenuStrip({
    required this.nodes,
    required this.open,
    this.selected,
    this.home = false,
  });

  final List<Json> nodes;
  final ValueChanged<String?> open;
  final String? selected;
  final bool home;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: MediaQuery.textScalerOf(context).scale(20) + 28,
    child: ListView(
      scrollDirection: Axis.horizontal,
      children: [
        if (home)
          ChoiceChip(
            label: Text('catalog_home'.tr),
            selected: selected == null,
            onSelected: (_) => open(null),
          ),
        for (final node in nodes)
          Padding(
            padding: const EdgeInsetsDirectional.only(start: 6),
            child: ChoiceChip(
              label: Text(catalogLabel(node)),
              selected: selected != null && selected == node['id'],
              onSelected: (_) => open(node['id'] as String),
            ),
          ),
      ],
    ),
  );
}
