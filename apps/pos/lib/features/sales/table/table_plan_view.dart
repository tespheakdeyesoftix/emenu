import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../core/pos_api.dart';
import '../../../shared/empty_state_widget.dart';
import '../sale_controller.dart';
import '../sale/sale_service.dart';
import 'widgets/table_card.dart';
import 'widgets/table_status_label.dart';

class TablePlanView extends GetView<SaleController> {
  const TablePlanView({super.key});

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final tables = service.tables;
    return GroupedTableCards(
      tables: tables,
      totals: service.tableSaleTotals(tables),
      currency: service.currency,
      configuredColors: service.config['table_status_colors'],
      initialGroupId: service.tableGroupId.value,
      onGroupChanged: (id) => service.tableGroupId.value = id,
      tableStatus: service.tableStatus,
      onTableTap: service.cartEditable ? controller.openTable : null,
    );
  });
}

class GroupedTableCards extends StatelessWidget {
  const GroupedTableCards({
    super.key,
    required this.tables,
    required this.totals,
    required this.currency,
    required this.configuredColors,
    required this.tableStatus,
    this.initialGroupId,
    this.onGroupChanged,
    this.selectedTableId,
    this.onTableTap,
  });

  final List<Json> tables;
  final Map<String, TableSaleTotals> totals;
  final String currency;
  final Object? configuredColors;
  final String Function(Json) tableStatus;
  final String? initialGroupId;
  final ValueChanged<String>? onGroupChanged;
  final String? selectedTableId;
  final void Function(BuildContext, Json)? onTableTap;

  @override
  Widget build(BuildContext context) {
    if (tables.isEmpty) {
      return EmptyStateWidget(
        icon: Icons.table_restaurant_outlined,
        title: 'no_tables'.tr,
      );
    }
    final colors = configuredColors;
    final configured = colors is Map ? jsonObject(colors) : <String, dynamic>{};
    final groups = <String, String>{
      for (final table in tables)
        table['group_id'] as String? ?? '':
            table['group_name'] as String? ?? 'tables'.tr,
    };
    final groupIds = groups.keys.toList();
    final initialIndex = groupIds.indexOf(initialGroupId ?? groupIds.first);
    return DefaultTabController(
      key: ValueKey(groups.keys.join('|')),
      initialIndex: initialIndex < 0 ? 0 : initialIndex,
      length: groups.length,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 14,
          children: [
            TabBar(
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              onTap: (index) => onGroupChanged?.call(groupIds[index]),
              tabs: [for (final label in groups.values) Tab(text: label)],
            ),
            Wrap(
              spacing: 14,
              runSpacing: 6,
              children: [
                for (final status in tableStatusColors.keys)
                  TableStatusLabel(
                    status,
                    tableStatusColor(status, configured),
                  ),
              ],
            ),
            Expanded(
              child: TabBarView(
                physics: const NeverScrollableScrollPhysics(),
                children: [
                  for (final id in groupIds)
                    _groupGrid(context, id, configured),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _groupGrid(BuildContext context, String group, Json configured) {
    final visible = tables
        .where((row) => (row['group_id'] ?? '') == group)
        .toList();
    final tap = onTableTap;
    return GridView.builder(
      key: PageStorageKey(group),
      gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 210,
        mainAxisExtent:
            144 * (MediaQuery.textScalerOf(context).scale(14) / 14).clamp(1, 2),
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: visible.length,
      itemBuilder: (context, index) {
        final table = visible[index];
        return Obx(
          () => TableCard(
            table: table,
            totals: totals[table['id']] ?? (guests: 0, amount: 0),
            currency: currency,
            status: tableStatus(table),
            configuredColors: configured,
            selected: table['id'] == selectedTableId,
            onTap: tap == null ? null : () => tap(context, table),
          ),
        );
      },
    );
  }
}
