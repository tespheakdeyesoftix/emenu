import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../helpers/helper.dart';
import '../../sale_controller.dart';
import 'bill_info_chip.dart';
import 'select_table_number_widget.dart';

class BillTableChip extends GetView<SaleController> {
  const BillTableChip({super.key});

  @override
  Widget build(BuildContext context) {
    final service = controller.service;
    final selected = service.tables
        .where((row) => row['id'] == service.tableId.value)
        .firstOrNull;
    return BillInfoChip(
      icon: Icons.table_restaurant_outlined,
      label: selected == null
          ? (service.tableMode == 'optional' ? 'counter'.tr : 'table'.tr)
          : tableLabel(selected),
      tooltip: 'table_plan'.tr,
      onTap: () => showDialog<void>(
        context: context,
        builder: (_) => const SelectTableNumberWidget(),
      ),
    );
  }
}
