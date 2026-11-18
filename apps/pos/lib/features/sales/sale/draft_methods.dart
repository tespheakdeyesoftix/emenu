part of 'sale_service.dart';

extension SaleDraftMethods on SaleService {
  Future<void> loadCart(RegisterOperator actor) async {
    final profileId = installation.value!.profileId;
    final (draft, waiting, parked) = await database.transaction(
      () async => (
        await database.cartDraft(actor.id, profileId),
        await database.tillCommand(actor.id) != null,
        await database.parkedTableIds(actor.id, profileId),
      ),
    );
    if (!identical(operator.value, actor)) return;
    clearCart();
    _cartSaveFailed = false;
    commandPending.value = waiting;
    _parkedTableIds.assignAll(parked);
    if (draft == null) return;
    final saved = jsonObject(jsonDecode(draft.payload));
    final quote = saved['quote_context'];
    _quoteContext.value = quote == null ? null : jsonObject(quote);
    tableId.value = saved['table_id'] as String?;
    guestCover.value = saved['guest_cover'] as int?;
    selectedPostingDate.value = saved['posting_date'] as String?;
    customerId.value = saved['customer_id'] as String?;
    if (draft.billId case final String id) {
      _activeBill.value = (id: id, revision: saved['bill_revision'] as int);
    }
    cart.assignAll(jsonRows(saved['lines']).map(CartLine.fromHeldSnapshot));
    clearStaleTableSelection(clearEmpty: true);
  }

  void clearStaleTableSelection({required bool clearEmpty}) {
    final selected = tableId.value;
    if (selected == null ||
        tableMode != 'required' ||
        _activeBill.value != null ||
        commandPending.value) {
      return;
    }
    final available = tables.any((table) => table['id'] == selected);
    if (available &&
        (!clearEmpty || cart.isNotEmpty || guestCover.value != null)) {
      return;
    }
    tableId.value = null;
    guestCover.value = null;
    _saveCart();
  }

  void _saveCart() {
    final actor = operator.value;
    final setup = installation.value;
    if (actor == null || setup == null) return;
    final bill = _activeBill.value;
    final payload = hasCartDraft
        ? jsonEncode({
            'bill_revision': bill?.revision,
            'quote_context': _quoteContext.value,
            'table_id': tableId.value,
            'guest_cover': guestCover.value,
            'posting_date': selectedPostingDate.value,
            'customer_id': customerId.value,
            'lines': cart.map((line) => line.heldSnapshot).toList(),
          })
        : null;
    _cartWrites = _cartWrites.then((_) async {
      try {
        if (payload == null) {
          await database.removeCartDraft(actor.id, setup.profileId);
        } else {
          await database.saveCartDraft(
            operatorId: actor.id,
            profileId: setup.profileId,
            billId: bill?.id,
            payload: payload,
          );
        }
        _cartSaveFailed = false;
      } catch (_) {
        _cartSaveFailed = true;
        message.value = 'CART_SAVE_FAILED';
      }
    });
  }

  Future<void> flushCart() async {
    await _cartWrites;
    if (!_cartSaveFailed) return;
    _saveCart();
    await _cartWrites;
    if (_cartSaveFailed) throw const FormatException('CART_SAVE_FAILED');
  }
}
