import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../core/pos_api.dart';
import '../../../../core/pricing.dart';
import '../../../../helpers/helper.dart';
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
    final theme = Theme.of(context);
    final optionTheme = theme.chipTheme.copyWith(
      color: WidgetStateProperty.resolveWith((states) =>
          states.contains(WidgetState.selected)
              ? const Color(0xff1d4ed8)
              : theme.colorScheme.surfaceContainerHigh),
      showCheckmark: true,
      checkmarkColor: Colors.white,
      labelStyle: theme.textTheme.labelLarge?.copyWith(
        color: WidgetStateColor.resolveWith((states) =>
            states.contains(WidgetState.selected) ? Colors.white : theme.colorScheme.onSurface),
      ),
      secondaryLabelStyle: theme.textTheme.labelLarge?.copyWith(color: Colors.white),
    );
    Widget section(
      String title,
      List<Widget> choices, {
      required bool requiredChoice,
    }) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 4,
      children: [
        Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(title, style: theme.textTheme.titleSmall),
            if (requiredChoice)
              Text(
                'product_option_required'.tr,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.error,
                ),
              ),
          ],
        ),
        ChipTheme(
          data: optionTheme,
          child: Wrap(spacing: 6, runSpacing: 4, children: choices),
        ),
      ],
    );

    return AlertDialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      titlePadding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      contentPadding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
      actionsPadding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      title: Text(
        catalogLabel(widget.product),
        style: theme.textTheme.titleLarge,
      ),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              if (portions.isNotEmpty)
                section('product_option_portion'.tr, [
                  for (final row in portions)
                    ChoiceChip(
                      selected: portion?['id'] == row['id'],
                      onSelected: (_) => setState(() => portion = row),
                      label: Text(
                        '${catalogLabel(row)} · ${displayAmount(row['price_minor'] as int, widget.currency)}',
                      ),
                    ),
                ], requiredChoice: true),
              for (final group in groups)
                section(catalogLabel(group), [
                  for (final option in jsonRows(group['options']))
                    FilterChip(
                      selected:
                          selections[group['id']]?.any(
                            (row) => row['id'] == option['id'],
                          ) ??
                          false,
                      label: Text(
                        option['price_minor'] == 0
                            ? catalogLabel(option)
                            : '${catalogLabel(option)} · ${displayAmount(option['price_minor'] as int, widget.currency)}',
                      ),
                      onSelected: (checked) => setState(() {
                        final list = selections.putIfAbsent(
                          group['id'] as String,
                          () => [],
                        );
                        if (checked) {
                          if (group['multiple'] != true) list.clear();
                          list.add({...option, 'group_id': group['id']});
                        } else {
                          list.removeWhere((row) => row['id'] == option['id']);
                        }
                      }),
                    ),
                ], requiredChoice: group['required'] == true),
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
