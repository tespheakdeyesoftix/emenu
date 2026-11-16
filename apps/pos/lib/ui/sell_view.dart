import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../core/pricing.dart';
import '../features/register/register_controller.dart';
import 'shared_widgets.dart';

String _label(Json row) {
  final lang = Get.locale?.languageCode ?? 'km';
  for (final key in [
    'label_$lang',
    'name_$lang',
    'label',
    'name',
    'label_en',
  ]) {
    final value = row[key]?.toString();
    if (value != null && value.trim().isNotEmpty) return value;
  }
  return row['id'] as String? ?? '';
}

class SellView extends StatefulWidget {
  const SellView(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<SellView> createState() => _SellViewState();
}

class _SellViewState extends State<SellView> {
  final search = TextEditingController();
  String term = '';
  String? section;

  RegisterController get controller => widget.controller;

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> _product(Json product) async {
    if (jsonRows(product['portions']).isEmpty &&
        jsonRows(product['modifier_groups']).isEmpty) {
      controller.add(CartLine(product));
      return;
    }
    final line = await showDialog<CartLine>(
      context: context,
      builder: (context) => _ProductOptions(product, controller.currency),
    );
    if (line != null) controller.add(line);
  }

  Widget _catalog() {
    final catalog = jsonObject(controller.snapshot.value!['catalog']);
    final nodes = jsonRows(catalog['nodes']);
    final products = controller.products.where((product) {
      final inSection =
          section == null ||
          (catalog['mode'] == 'menu'
              ? (product['menu_ids'] as List).contains(section)
              : product['category_id'] == section);
      return inSection &&
          ['name', 'name_en', 'name_km', 'code'].any(
            (key) =>
                product[key]?.toString().toLowerCase().contains(term) ?? false,
          );
    }).toList();
    return Column(
      spacing: 10,
      children: [
        TextField(
          controller: search,
          decoration: InputDecoration(
            labelText: 'search'.tr,
            prefixIcon: const Icon(Icons.search),
          ),
          onChanged: (text) => setState(() => term = text.trim().toLowerCase()),
          onSubmitted: (text) {
            final code = text.trim().toLowerCase();
            if (code.isEmpty) return;
            final matches = controller.products.where(
              (row) => row['code']?.toString().toLowerCase() == code,
            );
            if (matches.length == 1) {
              _product(matches.single);
              search.clear();
              setState(() => term = '');
            }
          },
        ),
        if (nodes.isNotEmpty)
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ChoiceChip(
                  label: Text('all'.tr),
                  selected: section == null,
                  onSelected: (_) => setState(() => section = null),
                ),
                for (final node in nodes)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 6),
                    child: ChoiceChip(
                      label: Text(_label(node)),
                      selected: section == node['id'],
                      onSelected: (_) =>
                          setState(() => section = node['id'] as String),
                    ),
                  ),
              ],
            ),
          ),
        Expanded(
          child: GridView.builder(
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 200,
              mainAxisExtent: 100,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final product = products[index];
              return OutlinedButton(
                onPressed: () => _product(product),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  spacing: 4,
                  children: [
                    Text(
                      _label(product),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                    Text(
                      displayAmount(
                        product['price_minor'] as int,
                        controller.currency,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _cart() => Obx(() {
    final currency = controller.currency;
    final total = controller.cartTotal;
    final tables = controller.tables;
    final customers = controller.customers;
    final selectedTable = controller.tableId.value;
    final selectedCustomer = controller.customerId.value;
    final editable = controller.cartEditable;
    final busy =
        !editable ||
        controller.storeAuthorityPending ||
        (controller.paired.value && !controller.online.value);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 8,
      children: [
        if (controller.quoteConfig['table_mode'] != 'disabled')
          _selection(
            'table',
            'counter',
            tables,
            selectedTable,
            editable ? controller.selectTable : null,
            enabled: (row) =>
                row['open_sale_id'] == null &&
                !controller.isHeldTable(row['id'] as String),
          ),
        if (customers.isNotEmpty)
          _selection(
            'customer',
            'default_customer',
            customers,
            selectedCustomer,
            editable ? controller.selectCustomer : null,
          ),
        Expanded(
          child: ListView.builder(
            itemCount: controller.cart.length,
            itemBuilder: (context, index) {
              final line = controller.cart[index];
              return ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text(line.name(Get.locale?.languageCode ?? 'km')),
                subtitle: Text(
                  displayAmount(controller.totalOf(line).total, currency),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove),
                      onPressed: editable
                          ? () => controller.quantity(index, line.quantity - 1)
                          : null,
                    ),
                    Text('${line.quantity}'),
                    IconButton(
                      icon: const Icon(Icons.add),
                      onPressed: editable
                          ? () => controller.quantity(index, line.quantity + 1)
                          : null,
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        Row(
          children: [
            if (controller.hasCartDraft)
              IconButton(
                tooltip: 'discard_draft'.tr,
                icon: const Icon(Icons.delete_outline),
                onPressed: !editable
                    ? null
                    : () async {
                        if (await confirmDiscard(context, 'discard_draft')) {
                          await controller.discardCart();
                        }
                      },
              ),
            Expanded(
              child: Text(
                '${'total'.tr}  ${displayAmount(total, currency)}',
                style: Theme.of(context).textTheme.titleLarge,
                textAlign: TextAlign.end,
              ),
            ),
          ],
        ),
        RegisterButton(
          'pay',
          icon: Icons.payments_outlined,
          onPressed: controller.cart.isEmpty || busy
              ? null
              : () async {
                  final payments = await showDialog<List<Json>>(
                    context: context,
                    builder: (context) => PaymentDialog(
                      total: total,
                      currency: currency,
                      rate: controller.exchangeRate,
                      types: controller.quotePaymentTypes,
                      defaultType:
                          controller.quoteConfig['default_payment_type_id']
                              as String?,
                    ),
                  );
                  if (payments != null) await controller.checkout(payments);
                },
        ),
        OutlinedButton.icon(
          onPressed: controller.cart.isEmpty || busy
              ? null
              : controller.holdCart,
          icon: const Icon(Icons.pause),
          label: Text('hold'.tr),
        ),
      ],
    );
  });

  Widget _selection(
    String label,
    String empty,
    List<Json> options,
    String? selected,
    ValueChanged<String?>? onChanged, {
    bool Function(Json)? enabled,
  }) {
    final selection = options.any((option) => option['id'] == selected)
        ? selected
        : null;
    return DropdownButtonFormField<String>(
      key: ValueKey((label, selection)),
      initialValue: selection ?? '',
      isExpanded: true,
      decoration: InputDecoration(labelText: label.tr),
      items: [
        DropdownMenuItem(value: '', child: Text(empty.tr)),
        for (final option in options)
          DropdownMenuItem(
            value: option['id'] as String,
            enabled: enabled?.call(option) ?? true,
            child: Text(_label(option), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged == null
          ? null
          : (value) => onChanged(value == '' ? null : value),
    );
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(12),
    child: LayoutBuilder(
      builder: (context, box) => box.maxWidth >= 650
          ? Row(
              children: [
                Expanded(child: _catalog()),
                const SizedBox(width: 16),
                SizedBox(width: 350, child: _cart()),
              ],
            )
          : DefaultTabController(
              length: 2,
              child: Column(
                children: [
                  TabBar(
                    tabs: [
                      Tab(text: 'sell'.tr),
                      Tab(text: 'pay'.tr),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Expanded(child: TabBarView(children: [_catalog(), _cart()])),
                ],
              ),
            ),
    ),
  );
}

class _ProductOptions extends StatefulWidget {
  const _ProductOptions(this.product, this.currency);

  final Json product;
  final String currency;

  @override
  State<_ProductOptions> createState() => _ProductOptionsState();
}

class _ProductOptionsState extends State<_ProductOptions> {
  Json? portion;
  final selections = <String, List<Json>>{};

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
      title: Text(_label(widget.product)),
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
                    '${portion?['id'] == row['id'] ? '✓ ' : ''}${_label(row)} · ${displayAmount(row['price_minor'] as int, widget.currency)}',
                  ),
                ),
              for (final group in groups) ...[
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(_label(group)),
                ),
                for (final option in jsonRows(group['options']))
                  CheckboxListTile(
                    value:
                        selections[group['id']]?.any(
                          (row) => row['id'] == option['id'],
                        ) ??
                        false,
                    title: Text(_label(option)),
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
          'add',
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

class PaymentDialog extends StatefulWidget {
  const PaymentDialog({
    super.key,
    required this.total,
    required this.currency,
    required this.rate,
    required this.types,
    required this.defaultType,
  });

  final int total;
  final String currency;
  final String rate;
  final List<Json> types;
  final String? defaultType;

  @override
  State<PaymentDialog> createState() => _PaymentDialogState();
}

class _PaymentDialogState extends State<PaymentDialog> {
  final amount = TextEditingController();
  final reference = TextEditingController();
  final entries = <Json>[];
  late Json type;
  late String currency;
  bool change = false;
  String? error;

  @override
  void initState() {
    super.initState();
    type = widget.types.firstWhere(
      (row) => row['id'] == widget.defaultType,
      orElse: () => widget.types.first,
    );
    final accepted = type['currencies'] as List;
    currency = accepted.contains(widget.currency)
        ? widget.currency
        : accepted.first as String;
    if (currency == widget.currency && widget.total > 0) {
      amount.text = currency == 'USD'
          ? (widget.total / 100).toStringAsFixed(2)
          : widget.total.toString();
    }
  }

  @override
  void dispose() {
    amount.dispose();
    reference.dispose();
    super.dispose();
  }

  int? get paid {
    try {
      return paymentTotal(
        entries: entries,
        paymentTypes: widget.types,
        primary: widget.currency,
        rate: widget.rate,
      );
    } on FormatException {
      return null;
    }
  }

  void _add() {
    final minor = parseAmount(amount.text, currency);
    if (minor == null || minor < 1 || entries.length >= 60) {
      setState(() => error = 'PAYMENT_TOTAL_MISMATCH');
      return;
    }
    setState(() {
      entries.add({
        'payment_type_id': type['id'],
        'currency': currency,
        'amount_minor': minor,
        'entry_type': change ? 'change' : 'tender',
        if (reference.text.trim().isNotEmpty)
          'reference': reference.text.trim(),
      });
      error = null;
      amount.clear();
      reference.clear();
    });
  }

  void _submit() {
    if (entries.isEmpty && widget.total > 0) _add();
    if (paid == widget.total) {
      Navigator.pop(context, List<Json>.of(entries));
    } else {
      setState(() => error = 'PAYMENT_TOTAL_MISMATCH');
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(displayAmount(widget.total, widget.currency)),
    content: SizedBox(
      width: 440,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            RegisterNotice(error),
            for (final (index, entry) in entries.indexed)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  displayAmount(
                    (entry['entry_type'] == 'change' ? -1 : 1) *
                        (entry['amount_minor'] as int),
                    entry['currency'] as String,
                  ),
                ),
                subtitle: Text(
                  widget.types.firstWhere(
                        (row) => row['id'] == entry['payment_type_id'],
                      )['name']
                      as String,
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.remove_circle_outline),
                  onPressed: () => setState(() => entries.removeAt(index)),
                ),
              ),
            DropdownButtonFormField<String>(
              initialValue: type['id'] as String,
              decoration: InputDecoration(labelText: 'payment_type'.tr),
              items: widget.types
                  .map(
                    (row) => DropdownMenuItem(
                      value: row['id'] as String,
                      child: Text(row['name'] as String),
                    ),
                  )
                  .toList(),
              onChanged: (id) => setState(() {
                type = widget.types.firstWhere((row) => row['id'] == id);
                final accepted = type['currencies'] as List;
                if (!accepted.contains(currency)) {
                  currency = accepted.first as String;
                  amount.clear();
                }
                if (type['kind'] != 'cash') change = false;
              }),
            ),
            DropdownButtonFormField<String>(
              key: ValueKey((type['id'], currency)),
              initialValue: currency,
              decoration: InputDecoration(labelText: 'currency'.tr),
              items: (type['currencies'] as List)
                  .cast<String>()
                  .map(
                    (value) =>
                        DropdownMenuItem(value: value, child: Text(value)),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                currency = value!;
                amount.clear();
              }),
            ),
            TextField(
              controller: amount,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: InputDecoration(labelText: 'amount'.tr),
            ),
            if (type['kind'] == 'cash')
              CheckboxListTile(
                value: change,
                title: Text('change'.tr),
                onChanged: (value) => setState(() => change = value!),
              )
            else
              TextField(
                controller: reference,
                maxLength: 160,
                decoration: InputDecoration(
                  labelText: 'reference'.tr,
                  counterText: '',
                ),
              ),
            OutlinedButton.icon(
              onPressed: _add,
              icon: const Icon(Icons.add),
              label: Text('add'.tr),
            ),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('back'.tr),
      ),
      RegisterButton('pay', onPressed: _submit),
    ],
  );
}
