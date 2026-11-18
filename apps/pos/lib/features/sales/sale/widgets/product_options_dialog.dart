import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
import '../../../../shared/forms/app_checkbox_field.dart';
import '../../../../ui/shared_widgets.dart';
import '../cart_line.dart';

class ProductOptionsDialog extends StatefulWidget {
  const ProductOptionsDialog(
    this.product,
    this.currency,
    this.initial, {
    super.key,
  });

  final Json product;
  final String currency;
  final CartLine? initial;

  @override
  State<ProductOptionsDialog> createState() =>
      ProductOptionsDialogDialogState();
}

class ProductOptionsDialogDialogState extends State<ProductOptionsDialog> {
  Json? portion;
  final selections = <String, List<Json>>{};

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    if (initial == null) return;
    portion = jsonRows(widget.product['portions'])
        .where((row) => row['id'] == initial.portion?['id'])
        .firstOrNull;
    final selected = initial.modifiers.map((row) => row['id']).toSet();
    for (final group in jsonRows(widget.product['modifier_groups'])) {
      final matching = jsonRows(group['options'])
          .where((row) => selected.contains(row['id']))
          .map((row) => {...row, 'group_id': group['id']});
      selections[group['id'] as String] =
          (group['multiple'] == true ? matching : matching.take(1)).toList();
    }
  }

  @override
  Widget build(BuildContext context) {
    final portions = jsonRows(widget.product['portions']);
    final groups = jsonRows(widget.product['modifier_groups']);
    final valid =
        (portions.isEmpty || portion != null) &&
        groups.every(
          (group) =>
              group['required'] != true ||
              (selections[group['id']]?.isNotEmpty ?? false),
        );
    return AlertDialog(
      title: Text(catalogLabel(widget.product)),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final row in portions)
                OutlinedButton(
                  onPressed: () => setState(() => portion = row),
                  child: Text(
                    '${portion?['id'] == row['id'] ? '✓ ' : ''}${catalogLabel(row)} · ${displayAmount(row['price_minor'] as int, widget.currency)}',
                  ),
                ),
              for (final group in groups) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(catalogLabel(group)),
                ),
                for (final option in jsonRows(group['options']))
                  AppCheckboxField(
                    value:
                        selections[group['id']]?.any(
                          (row) => row['id'] == option['id'],
                        ) ??
                        false,
                    title: Text(catalogLabel(option)),
                    subtitle: Text(
                      displayAmount(
                        option['price_minor'] as int,
                        widget.currency,
                      ),
                    ),
                    onChanged: (checked) => setState(() {
                      final list = selections.putIfAbsent(
                        group['id'] as String,
                        () => [],
                      );
                      if (checked == true) {
                        if (group['multiple'] != true) list.clear();
                        list.add(option);
                      } else {
                        list.removeWhere((row) => row['id'] == option['id']);
                      }
                    }),
                  ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
        RegisterButton(
          widget.initial == null ? 'add' : 'save',
          onPressed: valid
              ? () => Navigator.pop(
                  context,
                  CartLine(
                    widget.product,
                    portion: portion,
                    modifiers: selections.values
                        .expand((list) => list)
                        .toList(),
                  ),
                )
              : null,
        ),
      ],
    );
  }
}
