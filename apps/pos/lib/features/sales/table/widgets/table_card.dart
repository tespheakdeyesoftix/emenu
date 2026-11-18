import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../helpers/helper.dart';
import 'table_status_label.dart';

class TableCard extends StatelessWidget {
  const TableCard({
    super.key,
    required this.table,
    required this.status,
    required this.configuredColors,
    required this.onTap,
    this.selected = false,
  });

  final Json table, configuredColors;
  final String status;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final color = tableStatusColor(status, configuredColors);
    final theme = Theme.of(context);
    final title = tableLabel(table);
    final code = table['code']?.toString();
    return Semantics(
      value: 'table_$status'.tr,
      selected: selected ? true : null,
      child: Material(
        color: Color.alphaBlend(
          color.withValues(alpha: .22),
          theme.colorScheme.surface,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: color.withValues(alpha: .45)),
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
                            color: color,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium,
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Icon(tableStatusIcons[status], size: 18, color: color),
                    if (selected)
                      Icon(Icons.check_circle_outline, size: 18, color: color),
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
