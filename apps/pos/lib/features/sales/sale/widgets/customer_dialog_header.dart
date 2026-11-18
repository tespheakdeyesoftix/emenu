import 'package:flutter/material.dart';
import 'package:get/get.dart';

class CustomerDialogHeader extends StatelessWidget {
  const CustomerDialogHeader({
    super.key,
    required this.title,
    required this.icon,
  });

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
    child: Row(
      spacing: 10,
      children: [
        Icon(icon, color: Theme.of(context).colorScheme.primary, size: 22),
        Expanded(
          child: Text(title.tr, style: Theme.of(context).textTheme.titleMedium),
        ),
        IconButton(
          tooltip: 'close'.tr,
          onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close, size: 20),
        ),
      ],
    ),
  );
}
