import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../ui/shared_widgets.dart';

String catalogLabel(Json row) {
  final language = Get.locale?.languageCode ?? 'km';
  for (final key in [
    'label_$language',
    'name_$language',
    'label',
    'name',
    'label_en',
  ]) {
    final value = row[key]?.toString().trim();
    if (value != null && value.isNotEmpty) return value;
  }
  return row['id'] as String? ?? '';
}

String tableLabel(Json table) {
  final label = table['label'] as String?;
  return label == null || label.isEmpty ? table['code'].toString() : label;
}

Future<bool> confirmDiscard(BuildContext context, String label) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(label.tr),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('back'.tr),
          ),
          RegisterButton(
            'discard',
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    ) ??
    false;

String amountInputValue(int amount, String currency) =>
    currency == 'USD' ? (amount / 100).toStringAsFixed(2) : amount.toString();
