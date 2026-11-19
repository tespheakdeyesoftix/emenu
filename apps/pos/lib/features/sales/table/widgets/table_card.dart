import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
import '../../sale/sale_service.dart' show TableSaleTotals;
import 'table_status_label.dart';

class TableCard extends StatelessWidget {
  const TableCard({
    super.key,
    required this.table,
    required this.totals,
    required this.currency,
    required this.status,
    required this.configuredColors,
    required this.onTap,
    this.selected = false,
  });

  final Json table, configuredColors;
  final TableSaleTotals totals;
  final String currency;
  final String status;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final color = tableStatusColor(status, configuredColors);
    final ink = tableStatusForeground(color);
    final theme = Theme.of(context);
    final title = tableLabel(table);
    final code = table['code']?.toString();
    return Semantics(
      value: 'table_$status'.tr,
      selected: selected ? true : null,
      child: Material(
        color: color,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: selected ? ink : ink.withValues(alpha: .22)),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    spacing: 6,
                    children: [
                      if (code != null && code != title)
                        Text(
                          code,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: ink,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium?.copyWith(
                          color: ink,
                        ),
                      ),
                    ],
                  ),
                ),
                Row(
                  spacing: 4,
                  children: [
                    Icon(tableStatusIcons[status], size: 18, color: ink),
                    if (status != 'vacant') ...[
                      Tooltip(
                        message: 'guest_cover'.tr,
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          spacing: 3,
                          children: [
                            Icon(Icons.person_outline, size: 16, color: ink),
                            Text(
                              '${totals.guests}',
                              style: theme.textTheme.labelMedium?.copyWith(
                                color: ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Expanded(
                        child: Align(
                          alignment: AlignmentDirectional.centerEnd,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              displayAmount(totals.amount, currency),
                              style: theme.textTheme.titleSmall?.copyWith(
                                color: ink,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ] else if (selected)
                      const Spacer(),
                    if (selected)
                      Icon(Icons.check_circle_outline, size: 18, color: ink),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
