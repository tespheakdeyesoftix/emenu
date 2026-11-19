import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';

const tableStatusColors = {
  'vacant': 0xff2f7656,
  'occupied': 0xff245eb2,
  'bill_requested': 0xffb45309,
  'hold': 0xff6b4aa0,
  'booked': 0xffae356c,
};
const tableStatusIcons = {
  'vacant': Icons.event_seat_outlined,
  'occupied': Icons.groups_outlined,
  'bill_requested': Icons.request_quote_outlined,
  'hold': Icons.pause_circle_outline,
  'booked': Icons.event_available_outlined,
};

Color tableStatusColor(String status, Json configured) {
  final hex = configured[status];
  final raw = hex is String && RegExp(r'^#[a-fA-F0-9]{6}$').hasMatch(hex)
      ? int.parse(hex.substring(1), radix: 16) | 0xff000000
      : null;
  return Color(
    raw ?? tableStatusColors[status] ?? tableStatusColors['vacant']!,
  );
}

Color tableStatusForeground(Color background) =>
    background.computeLuminance() > 0.179 ? Colors.black : Colors.white;

class TableStatusLabel extends StatelessWidget {
  const TableStatusLabel(this.status, this.color, {super.key});
  final String status;
  final Color color;

  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    spacing: 6,
    children: [
      DecoratedBox(
        decoration: BoxDecoration(
          color: color,
          border: Border.all(
            color: tableStatusForeground(color).withValues(alpha: .22),
          ),
          borderRadius: BorderRadius.circular(5),
        ),
        child: Padding(
          padding: const EdgeInsets.all(3),
          child: Icon(
            tableStatusIcons[status],
            color: tableStatusForeground(color),
            size: 15,
          ),
        ),
      ),
      Flexible(
        child: Text(
          'table_$status'.tr,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelSmall
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
    ],
  );
}
