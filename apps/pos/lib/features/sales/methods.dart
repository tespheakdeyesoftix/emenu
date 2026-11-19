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
    final generation = service.billGeneration;
    final line =
        jsonRows(product['portions']).isEmpty &&
            jsonRows(product['modifier_groups']).isEmpty
        ? CartLine(product)
        : await chooseOptions(context, product, null);
    if (!context.mounted ||
        line == null ||
        generation != service.billGeneration)
      return;
    final added = service.add(line);
    if (added != null) selectedLine.value = added;
  }

  Future<void> pay(BuildContext context, int total) async {
    if (!service.canPay || !service.allowsAction("allow_process_payment")) return;
    if (total != service.cartTotal) {
      service.message.value = 'PRICE_CHANGED';
      return;
    }
    if (total == 0) {
      await service.checkout(const []);
      return;
    }
    final generation = service.billGeneration;
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
    if (!context.mounted ||
        payments == null ||
        generation != service.billGeneration ||
        !service.canPay) {
      return;
    }
    if (total != service.cartTotal) {
      service.message.value = 'PRICE_CHANGED';
      return;
    }
    await service.checkout(payments);
  }

  Future<void> submitOrder(BuildContext context) async {
    if (_confirmingSubmit || !service.canSubmit) return;
    final generation = service.billGeneration;
    _confirmingSubmit = true;
    try {
      if (await app.onConfirm('cart_submit_confirm'.tr) &&
          context.mounted &&
          !isClosed &&
          generation == service.billGeneration) {
        if (await service.submitOrder()) selectedLine.value = null;
      }
    } finally {
      _confirmingSubmit = false;
    }
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
        if (!service.allowsAction('allow_free_item')) { service.message.value = 'PERMISSION_DENIED'; return; }
        if (line.isFree) {
          replaceLine(line, service.restorePrice(line));
        } else {
          await markItemFree(context, line);
        }
      case CartAction.note:
        await editItemNote(context, line);
      case CartAction.discount:
        if (!service.allowsAction('allow_discount_on_item')) { service.message.value = 'PERMISSION_DENIED'; return; }
        if (line.hasDiscount) {
          replaceLine(line, line.withDiscount());
        } else {
          await editDiscount(context, line);
        }
    }
  }

  Future<void> editItemNote(BuildContext context, CartLine line) async {
    if (!service.supportsCartLineEdits || line.voided) return;
    try {
      await NoteDialogWidget.edit(
        context,
        database: service.database,
        noteKey: line.product['id'] as String,
        title: 'cart_note'.tr,
        initial: line.note,
        apply: (note) {
          if (!service.supportsCartLineEdits ||
              !service.cartEditable ||
              !service.cart.contains(line)) {
            return false;
          }
          final next = line.withLineEdits({...line.lineEdits, 'note': note});
          replaceLine(line, next);
          return service.cart.contains(next);
        },
      );
    } catch (error) {
      service.register.showError(error);
    }
  }

  Future<void> editSaleNote(BuildContext context) async {
    if (!service.cartEditable || !service.supportsSaleNotes) return;
    final generation = service.billGeneration;
    final profileId = jsonObject(service.context['profile'])['id'];
    try {
      await NoteDialogWidget.edit(
        context,
        database: service.database,
        noteKey: 'sale:$profileId',
        title: 'sale_note'.tr,
        initial: service.saleNote.value,
        apply: (note) =>
            generation == service.billGeneration && service.setSaleNote(note),
      );
    } catch (error) {
      service.register.showError(error);
    }
  }

  Future<void> markItemFree(BuildContext context, CartLine line) async {
    if (!service.supportsFreeItemReasons || line.voided) return;
    if (!service.checkProductEdit(line, CartProductEdit.free)) return;
    try {
      final reasons = await service.database.freeItemReasons();
      if (!context.mounted ||
          !service.cartEditable ||
          !service.cart.contains(line)) {
        return;
      }
      if (!service.checkProductEdit(line, CartProductEdit.free)) return;
      final choice = await showDialog<FreeItem>(
        context: context,
        builder: (_) => FreeItemDialog(quantity: line.quantity, reasons: reasons),
      );
      if (choice == null || !context.mounted) return;
      final free = await service.markItemFree(
        line,
        choice.quantity,
        choice.reason.text,
        remember: choice.reason.remember,
      );
      if (free != null && !isClosed && service.cart.contains(free)) {
        selectedLine.value = free;
      }
    } catch (error) {
      service.register.showError(error);
    }
  }

  Future<void> editPrice(BuildContext context, CartLine line) async {
    bool editable() => service.cartEditable && service.cart.contains(line) &&
        service.supportsCartLineEdits && !line.voided && !line.isFree;
    if (!editable() || !service.checkProductEdit(line, CartProductEdit.price)) {
      return;
    }
    final currency = service.currency;
    const key = 'base_price_override_minor';
    try {
      final reasons = await service.database.priceReasons();
      if (!context.mounted || !editable()) return;
      final change = await showDialog<PriceChange>(
        context: context,
        builder: (_) => ChangePriceDialog(
          line: line,
          currency: currency,
          reasons: reasons,
          validAmount: (amount) =>
              service.validLineAmount(line, key, amountInputValue(amount, currency)),
        ),
      );
      if (change == null || !context.mounted || !editable()) return;
      if (!service.checkProductEdit(line, CartProductEdit.price)) return;
      final override = change.amount == line.catalogBase ? null : change.amount;
      if (line.basePriceOverride == override) return;
      final next = line.withLineEdits({
        ...line.lineEdits,
        key: override,
        'price_change_reason': change.reason,
      });
      replaceLine(line, next);
      if (change.remember && service.cart.contains(next)) {
        await service.database.rememberPriceReason(change.reason);
      }
    } catch (error) {
      service.register.showError(error);
    }
  }

  Future<void> editDiscount(BuildContext context, CartLine line) async {
    bool editable() => service.cartEditable && service.cart.contains(line) &&
        service.supportsItemDiscountDetails && !line.voided && !line.isFree &&
        !line.hasDiscount;
    if (!editable() || !service.checkProductEdit(line, CartProductEdit.discount)) {
      return;
    }
    try {
      final reasons = await service.database.discountReasons();
      if (!context.mounted || !editable()) return;
      final subtotal = service.totalOf(line).subtotal;
      if (subtotal == 0) {
        service.message.value = 'INVALID_LINE_EDIT';
        return;
      }
      final discount = await showDialog<ItemDiscount>(
        context: context,
        builder: (_) => ItemDiscountDialog(
          currency: service.currency,
          subtotal: subtotal,
          reasons: reasons,
        ),
      );
      if (!context.mounted || discount == null || !editable() ||
          !service.checkProductEdit(line, CartProductEdit.discount)) {
        return;
      }
      final next = line.withDiscount(
        amount: discount.amount,
        bps: discount.bps,
        note: discount.reason.text,
      );
      replaceLine(line, next);
      if (discount.reason.remember && service.cart.contains(next)) {
        await service.database.rememberDiscountReason(discount.reason.text);
      }
    } catch (error) {
      service.register.showError(error);
    }
  }

  Future<void> editQuantity(BuildContext context, CartLine line) async {
    if (!line.canEditQuantity || !service.cartEditable) return;
    final value = await app.input_number(
      title: 'cart_qty'.tr,
      value: line.quantity,
      isFloat: true,
      decimalPlaces: 3,
      min: 0.001,
      max: 999,
    );
    if (value != null && context.mounted && service.cartEditable) {
      replaceLine(line, line.withQuantity(normalizedQuantity(value)));
    }
  }

  Future<void> deleteLine(BuildContext context, CartLine line) async {
    final index = service.cart.indexOf(line);
    if (!service.cartEditable || line.voided || index < 0) return;
    if (!line.submitted) {
      service.quantity(index, 0);
      if (identical(selectedLine.value, line)) selectedLine.value = null;
      return;
    }

    final List<String> reasons;
    try {
      reasons = await service.database.deletionReasons();
    } catch (error) {
      service.register.showError(error);
      return;
    }
    if (!context.mounted || !service.cart.contains(line)) return;
    final deletion = await showDialog<ItemDeletion>(
      context: context,
      builder: (_) => DeleteCartItemDialog(
        line: line,
        reasons: reasons,
        database: service.database,
      ),
    );
    if (deletion != null && context.mounted) {
      final remaining = await service.deleteQuantity(
        line,
        deletion.quantity,
        deletion.reason,
        deletion.remember,
      );
      if (!isClosed &&
          identical(selectedLine.value, line) &&
          !service.cart.contains(line))
        selectedLine.value = remaining;
    }
  }
}
