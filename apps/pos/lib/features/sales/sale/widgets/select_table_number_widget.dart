import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';
import '../../table/table_plan_view.dart';
import '../sale_service.dart';

class SelectTableNumberWidget extends GetView<SaleController> {
  const SelectTableNumberWidget({super.key});

  @override
  Widget build(BuildContext context) => Dialog(
    insetPadding: const EdgeInsets.all(16),
    constraints: const BoxConstraints(maxWidth: 760, maxHeight: 620),
    child: Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 12, 12, 0),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'table_plan'.tr,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              IconButton(
                tooltip: 'close'.tr,
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
        Expanded(
          child: Obx(() {
            final service = controller.service;
            final tables = service.tables;
            final tableId = service.tableId.value;
            final table = tables
                .where((row) => row['id'] == tableId)
                .firstOrNull;
            return GroupedTableCards(
              tables: tables,
              configuredColors: service.config['table_status_colors'],
              initialGroupId:
                  table?['group_id'] as String? ?? service.tableGroupId.value,
              tableStatus: service.tableStatus,
              selectedTableId: tableId,
            );
          }),
        ),
      ],
    ),
  );
}
