import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../../../../shared/forms/app_selection_field.dart';
import '../../../../shared/forms/app_text_form_field.dart';
import '../../../../ui/shared_widgets.dart';
import '../sale_screen_settings.dart';

class SaleScreenSettingDialogWidget extends StatefulWidget {
  const SaleScreenSettingDialogWidget({
    super.key,
    required this.initialSettings,
    required this.save,
    required this.message,
  });

  final SaleScreenSettings initialSettings;
  final Future<bool> Function(SaleScreenSettings) save;
  final RxnString message;

  @override
  State<SaleScreenSettingDialogWidget> createState() =>
      _SaleScreenSettingDialogWidgetState();
}

class _SaleScreenSettingDialogWidgetState
    extends State<SaleScreenSettingDialogWidget> {
  final _form = GlobalKey<FormState>();
  late SaleScreenLayout _layout = widget.initialSettings.layout;
  late final _width = TextEditingController(
    text: '${widget.initialSettings.orderProductListWidth}',
  );
  late final _catalogWidth = TextEditingController(
    text: '${widget.initialSettings.catalogWidth}',
  );
  bool _saving = false;

  Future<void> _save() async {
    if (_saving || !_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final saved = await widget.save(
      SaleScreenSettings(
        layout: _layout,
        orderProductListWidth: int.parse(_width.text),
        catalogWidth: int.parse(_catalogWidth.text),
      ),
    );
    if (!mounted) return;
    if (saved) {
      Navigator.pop(context);
    } else {
      setState(() => _saving = false);
    }
  }

  @override
  void dispose() {
    _width.dispose();
    _catalogWidth.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !_saving,
    child: AlertDialog(
      scrollable: true,
      title: Text('sell_screen_settings'.tr),
      content: SizedBox(
        width: 420,
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 18,
            children: [
              Obx(() => RegisterNotice(widget.message.value)),
              AppSelectionField<SaleScreenLayout>(
                label: 'sell_screen_layout',
                initialValue: _layout,
                isExpanded: true,
                items: [
                  for (final layout in SaleScreenLayout.values)
                    DropdownMenuItem(value: layout, child: Text(layout.key.tr)),
                ],
                onChanged: _saving
                    ? null
                    : (value) => setState(() => _layout = value!),
              ),
              AppTextFormField(
                key: const ValueKey('order-product-list-width'),
                controller: _width,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: 'order_product_list_width'.tr,
                  suffixText: 'px',
                  helperText: 'order_width_help'.tr,
                  helperMaxLines: 3,
                ),
                validator: (input) {
                  final value = int.tryParse(input ?? '');
                  return value == null ||
                          value < SaleScreenSettings.minWidth ||
                          value > SaleScreenSettings.maxWidth
                      ? 'INVALID_ORDER_WIDTH'.tr
                      : null;
                },
                onFieldSubmitted: _saving ? null : (_) => _save(),
              ),
              AppTextFormField(
                key: const ValueKey('catalog-width'),
                controller: _catalogWidth,
                enabled: !_saving,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: 'catalog_width'.tr,
                  suffixText: 'px',
                  helperText: 'catalog_width_help'.tr,
                  helperMaxLines: 3,
                ),
                validator: (input) {
                  final value = int.tryParse(input ?? '');
                  return value == null ||
                          value < SaleScreenSettings.minCatalogWidth ||
                          value > SaleScreenSettings.maxCatalogWidth
                      ? 'INVALID_CATALOG_WIDTH'.tr
                      : null;
                },
                onFieldSubmitted: _saving ? null : (_) => _save(),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: Text('cancel'.tr),
        ),
        RegisterButton('save', onPressed: _saving ? null : _save),
      ],
    ),
  );
}
