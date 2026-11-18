import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';

class SaleScreenSettingsMenu extends GetView<SaleController> {
  const SaleScreenSettingsMenu({super.key});

  @override
  Widget build(BuildContext context) => Obx(
    () => PopupMenuButton<String>(
      key: const ValueKey('sale-screen-settings-menu'),
      enabled: !controller.service.busy.value,
      tooltip: 'sell_screen_settings'.tr,
      icon: const Icon(Icons.more_vert),
      onSelected: (value) => value == 'reload'
          ? controller.reloadMenu()
          : controller.openScreenSettings(),
      itemBuilder: (_) => [
        PopupMenuItem(value: 'reload', child: Text('reload_menu'.tr)),
        PopupMenuItem(
          value: 'settings',
          child: Text('sell_screen_settings'.tr),
        ),
      ],
    ),
  );
}
