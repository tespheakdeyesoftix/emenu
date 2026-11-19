part of 'sale_service.dart';

extension HeldBillMethods on SaleService {
  bool isHeldTable(String id) => heldBills.any(
    (bill) => bill.tableId == id && bill.id != _activeBill.value?.id,
  );

  Future<bool> submitOrder() async {
    if (!canSubmit) return false;
    return _saveOpenOrder(
      'occupied',
      returnToTables: tableMode == 'required',
      submit: true,
    );
  }

  Future<bool> holdCart({String tableStatus = 'hold'}) => _saveOpenOrder(
    tableStatus,
    returnToTables: tableMode == 'required' || tableStatus != 'hold',
  );

  Future<bool> _saveOpenOrder(
    String tableStatus, {
    required bool returnToTables,
    bool submit = false,
  }) async {
    var saved = false;
    await register.run(() async {
      await flushCart();
      await register.sendCommand(RegisterAction.hold, {
        ..._cartCommand(),
        'table_status': tableStatus,
        if (submit) 'submit_order': true,
      });
      clearCart();
      if (returnToTables) tab.value = SaleService.tablesTab;
      message.value = switch (tableStatus) {
        'bill_requested' => 'BILL_REQUESTED',
        'occupied' => 'ORDER_SAVED',
        _ => 'BILL_HELD',
      };
      saved = true;
      if (submit) register.wakeSaleSync();
    });
    return saved;
  }

  void openHeldBillFromHistory(HeldBill bill) {
    if (tableMode == 'required' && bill.tableId != null) {
      final table = tables
          .where((row) => row['id'] == bill.tableId)
          .firstOrNull;
      if (table != null) {
        tableGroupId.value = table['group_id'] as String?;
        tab.value = SaleService.tablesTab;
        return;
      }
    }
    resumeBill(bill);
  }

  void resumeBill(HeldBill bill) {
    if (!cartEditable) return;
    if (hasCartDraft) {
      message.value = 'HOLD_CURRENT_BILL';
      return;
    }
    final saved = jsonObject(jsonDecode(bill.payload));
    _quoteContext.value = jsonObject(saved['quote_context']);
    tableId.value = bill.tableId;
    guestCover.value = saved['guest_cover'] as int?;
    selectedPostingDate.value = saved['posting_date'] as String?;
    billGeneration++;
    customerId.value = saved['customer_id'] as String?;
    _activeBill.value = (id: bill.id, revision: bill.revision);
    cart.assignAll(jsonRows(saved['lines']).map(CartLine.fromHeldSnapshot));
    message.value = null;
    selectTab(SaleService.sellTab);
    _saveCart();
  }

  Future<void> discardBill(HeldBill bill) => register.run(() async {
    await flushCart();
    await register.sendCommand(RegisterAction.discard, {
      'bill_id': bill.id,
      'bill_revision': bill.revision,
    });
    if (_activeBill.value?.id == bill.id) clearCart();
    register.wakeSaleSync();
  });
}
