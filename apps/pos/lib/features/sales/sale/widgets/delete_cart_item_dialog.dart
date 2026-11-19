import 'package:flutter/material.dart';
import '../../../../core/pricing.dart';
import 'package:get/get.dart';

import '../../../../core/register_database.dart';
import '../cart_line.dart';

typedef ItemDeletion = ({num quantity, String reason, bool remember});

class DeleteCartItemDialog extends StatefulWidget {
  const DeleteCartItemDialog({
    super.key,
    required this.line,
    required this.reasons,
    required this.database,
  });

  final CartLine line;
  final List<String> reasons;
  final RegisterDatabase database;

  @override
  State<DeleteCartItemDialog> createState() => _DeleteCartItemDialogState();
}

class _DeleteCartItemDialogState extends State<DeleteCartItemDialog> {
  final reason = TextEditingController();
  late final quantity = TextEditingController(
    text: widget.line.quantity < 1 ? '${widget.line.quantity}' : '1',
  );
  late final saved = [...widget.reasons];
  bool remember = false;
  bool removing = false;
  String? error;

  @override
  void dispose() {
    quantity.dispose();
    reason.dispose();
    super.dispose();
  }

  Future<void> forget(String value) async {
    setState(() {
      removing = true;
      error = null;
    });
    try {
      await widget.database.forgetDeletionReason(value);
      if (mounted)
        setState(() {
          saved.remove(value);
          remember = false;
        });
    } catch (_) {
      if (mounted) setState(() => error = 'LOCAL_ERROR'.tr);
    } finally {
      if (mounted) setState(() => removing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = num.tryParse(quantity.text);
    final value = reason.text.trim();
    final validQty =
        count != null && validSaleQuantity(count) && count <= widget.line.quantity;
    final alreadySaved = saved.any(
      (s) => s.toLowerCase() == value.toLowerCase(),
    );
    final colors = Theme.of(context).colorScheme;
    return AlertDialog(
      title: Text('cart_delete_item'.tr),
      content: SizedBox(
        width: 380,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 12,
            children: [
              Text(widget.line.name(Get.locale?.languageCode ?? 'km')),
              TextField(
                controller: quantity,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: 'cart_delete_qty'.tr,
                  suffixText: '/ ${widget.line.quantity}',
                  errorText: validQty
                      ? null
                      : 'cart_delete_range'.trParams({
                          'max': '${widget.line.quantity}',
                        }),
                ),
                onChanged: (_) => setState(() {}),
              ),
              TextField(
                controller: reason,
                maxLength: 250,
                decoration: InputDecoration(
                  labelText: 'reason'.tr,
                  counterText: '',
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (saved.isNotEmpty)
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: [
                    for (final item in saved)
                      InputChip(
                        label: Text(item),
                        selected: value == item,
                        onPressed: removing
                            ? null
                            : () => setState(() {
                                reason.text = item;
                                remember = false;
                              }),
                        deleteButtonTooltipMessage: 'cart_forget_reason'.tr,
                        onDeleted: removing ? null : () => forget(item),
                      ),
                  ],
                ),
              if (!alreadySaved)
                CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  dense: true,
                  title: Text('cart_remember_reason'.tr),
                  value: remember,
                  onChanged: (next) => setState(() => remember = next == true),
                ),
              if (error != null)
                Text(error!, style: TextStyle(color: colors.error)),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('back'.tr),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: colors.error,
            foregroundColor: colors.onError,
          ),
          onPressed: validQty && value.isNotEmpty && !removing
              ? () => Navigator.pop(context, (
                  quantity: count!,
                  reason: value,
                  remember: remember && !alreadySaved,
                ))
              : null,
          child: Text('cart_delete'.tr),
        ),
      ],
    );
  }
}
