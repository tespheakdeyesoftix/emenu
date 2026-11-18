part of 'sale_controller.dart';

extension SaleMethods on SaleController {
  Future<CartLine?> chooseOptions(
    BuildContext context,
    Json product,
    CartLine? initial,
  ) => showDialog<CartLine>(
    context: context,
    builder: (_) => ProductOptionsDialog(product, service.currency, initial),
  );

  Future<void> addProduct(BuildContext context, Json product) async {
    if (!service.cartEditable) return;
    if (jsonRows(product['portions']).isEmpty &&
        jsonRows(product['modifier_groups']).isEmpty) {
      service.add(CartLine(product));
      return;
    }
    final line = await chooseOptions(context, product, null);
    if (context.mounted && line != null) service.add(line);
  }

  Future<void> pay(BuildContext context, int total) async {
    if (!service.canSubmit) return;
    if (total == 0) {
      await service.checkout(const []);
      return;
    }
    final payments = await showDialog<List<Json>>(
      context: context,
      builder: (_) => PaymentDialog(
        total: total,
        currency: service.currency,
        rate: service.exchangeRate,
        types: service.quotePaymentTypes,
        defaultType: service.quoteConfig['default_payment_type_id'] as String?,
      ),
    );
    if (context.mounted && payments != null) await service.checkout(payments);
  }

  Future<void> discardDraft(BuildContext context) async {
    if (await confirmDiscard(context, 'discard_draft') && context.mounted) {
      await service.discardCart();
      selectedLine.value = null;
    }
  }

  Future<void> onCartAction(
    BuildContext context,
    CartLine line,
    CartAction action,
  ) async {
    if (!service.cartEditable || !service.cart.contains(line)) return;
    switch (action) {
      case CartAction.edit:
        final product = service.cartCatalogProduct(line);
        if (product == null) return;
        final next = await chooseOptions(context, product, line);
        if (context.mounted && next != null) {
          replaceLine(line, service.withOptions(line, next));
        }
      case CartAction.free:
        replaceLine(line, service.toggleFree(line));
      case CartAction.note:
        final note = await editValueDialog(
          context,
          label: 'cart_note',
          initial: line.note ?? '',
          isNote: true,
          validate: (value) =>
              value.trim().length > 500 ? 'INVALID_LINE_EDIT'.tr : null,
        );
        if (context.mounted && note != null) {
          replaceLine(
            line,
            line.withLineEdits({...line.lineEdits, 'note': note}),
          );
        }
      case CartAction.discount:
        await editAmount(context, line, discount: true);
    }
  }

  Future<void> editAmount(
    BuildContext context,
    CartLine line, {
    required bool discount,
  }) async {
    final currency = service.currency;
    final key = discount ? 'discount_minor' : 'base_price_override_minor';
    final value = await editValueDialog(
      context,
      label: discount ? 'cart_discount' : 'cart_base_price',
      initial: amountInputValue(
        discount ? line.discount : line.basePrice,
        currency,
      ),
      allowReset: !discount && line.basePriceOverride != null,
      decimal: currency == 'USD',
      validate: (input) => service.validLineAmount(line, key, input)
          ? null
          : 'INVALID_LINE_EDIT'.tr,
    );
    if (context.mounted && value != null) {
      replaceLine(
        line,
        line.withLineEdits({
          ...line.lineEdits,
          key: parseAmount(value, currency),
        }),
      );
    }
  }

  Future<void> editQuantity(BuildContext context, CartLine line) async {
    final value = await editValueDialog(
      context,
      label: 'cart_qty',
      initial: '${line.quantity}',
      validate: (input) {
        final quantity = int.tryParse(input);
        return quantity != null && quantity >= 1 && quantity <= 999
            ? null
            : 'cart_invalid_quantity'.tr;
      },
    );
    if (context.mounted && value != null) {
      replaceLine(line, line.withQuantity(int.parse(value)));
    }
  }

  Future<void> deleteLine(BuildContext context, CartLine line) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('cart_delete_item'.tr),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('back'.tr),
          ),
          RegisterButton(
            'cart_delete',
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      service.quantity(service.cart.indexOf(line), 0);
      selectedLine.value = null;
    }
  }
}
