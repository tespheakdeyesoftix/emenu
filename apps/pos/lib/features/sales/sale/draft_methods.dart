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
    saleNote.value = saved['note'] as String?;
    final lines = jsonRows(saved['lines']);
    if (draft.billId case final String id) {
      _activeBill.value = (id: id, revision: saved['bill_revision'] as int);
      if (lines.any((row) => row['status'] == null)) {
        final bill =
            heldBills.where((bill) => bill.id == id).firstOrNull ??
            await database.heldBill(profileId, id);
        if (!identical(operator.value, actor)) return;
        if (bill != null) {
          final original = CartLine.billLines(
            jsonObject(jsonDecode(bill.payload)),
          );
          for (final row in lines.where((row) => row['status'] == null)) {
            final line = CartLine.fromHeldSnapshot(row);
            final match = original.indexWhere(
              (old) => old.matchesSelection(
                line.quote(quoteConfig),
                line.modifiers.map((option) => option['id'] as String).toSet(),
              ),
            );
            if (match >= 0) row.addAll(original.removeAt(match).order);
          }
        }
      }
    }
    cart.assignAll(lines.map(CartLine.fromHeldSnapshot));
    voidedLines.assignAll(
      jsonRows(saved['voided_lines']).map(CartLine.fromHeldSnapshot),
    );
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
        (!clearEmpty || cart.isNotEmpty || guestCover.value != null ||
            saleNote.value != null)) {
      return;
    }
    tableId.value = null;
    guestCover.value = null;
    _saveCart();
  }

  Future<void> Function() _draftWriter(
    List<CartLine> items,
    List<CartLine> voids,
  ) {
    final actor = operator.value;
    final setup = installation.value;
    if (actor == null || setup == null) return () async {};
    final bill = _activeBill.value;
    final payload = (items.isNotEmpty || _hasBillDetails)
        ? jsonEncode({
            'bill_revision': bill?.revision,
            'quote_context': items.isEmpty && bill == null
                ? null
                : _quoteContext.value,
            'table_id': tableId.value,
            'guest_cover': guestCover.value,
            'posting_date': selectedPostingDate.value,
            'customer_id': customerId.value,
            if (saleNote.value != null) 'note': saleNote.value,
            'lines': items.map((line) => line.heldSnapshot).toList(),
            'voided_lines': voids.map((line) => line.heldSnapshot).toList(),
          })
        : null;
    return () async {
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
    };
  }

  void _saveCart() {
    final write = _draftWriter(cart, voidedLines);
    _cartWrites = _cartWrites.then((_) async {
      try {
        await write();
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
