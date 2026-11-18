part of '../sale/sale_service.dart';

extension TableMethods on SaleService {
  bool get promptGuestCover => config['prompt_guest_cover'] == true;

  void selectTable(String? id, {int? cover}) {
    if (!cartEditable || tableMode == 'disabled') return;
    if (id == null && tableMode == 'required') return;
    if (id != null && !tables.any((row) => row['id'] == id)) return;
    if (id != null && !canAssignTable(id) && id != tableId.value) return;
    if (id != tableId.value || cover != null) {
      guestCover.value =
          cover ?? (id == null && promptGuestCover ? guestCover.value : null);
    }
    tableId.value = id;
    _saveCart();
  }

  Future<void> openTable(String id, {int? cover}) async {
    if (!cartEditable || tableMode == 'disabled') return;
    if (tableId.value == id) {
      message.value = null;
      tab.value = SaleService.sellTab;
      return;
    }

    var held = heldBills.where((bill) => bill.tableId == id).firstOrNull;
    final parked = hasParkedTable(id);
    if (held == null && !parked && !canAssignTable(id)) {
      message.value = 'TABLE_OCCUPIED';
      return;
    }

    if (_activeBill.value != null && cart.isEmpty) {
      message.value = 'EMPTY_CART';
      tab.value = SaleService.sellTab;
      return;
    }
    var keptLocally = false;
    if (cart.isNotEmpty && (tableId.value != null || held != null || parked)) {
      if (tableId.value == null && tableMode == 'required') {
        message.value = 'TABLE_REQUIRED';
        return;
      }
      final current = heldBills
          .where((bill) => bill.id == _activeBill.value?.id)
          .firstOrNull;
      final status = tableId.value == null
          ? 'hold'
          : current == null
          ? 'occupied'
          : jsonObject(jsonDecode(current.payload))['table_status']
                    as String? ??
                'hold';
      if (!await holdCart(tableStatus: status)) {
        if (!cartEditable ||
            _activeBill.value != null ||
            tableId.value == null ||
            !const {
              'PRICE_CHANGED',
              'SELECTION_CHANGED',
            }.contains(message.value)) {
          return;
        }
        keptLocally = await _parkTableDraft(tableId.value!);
        if (!keptLocally) return;
      }
      if (!cartEditable) return;
      held = heldBills.where((bill) => bill.tableId == id).firstOrNull;
    }

    if (parked) {
      await register.run(() async {
        final actor = operator.value!;
        await flushCart();
        await database.restoreTableDraft(
          actor.id,
          installation.value!.profileId,
          id,
        );
        await loadCart(actor);
        tab.value = SaleService.sellTab;
      });
      return;
    }
    if (held != null) {
      if (cart.isEmpty && _activeBill.value == null) clearCart();
      resumeBill(held);
      return;
    }
    if (!canAssignTable(id)) {
      message.value = 'TABLE_OCCUPIED';
      return;
    }
    selectTable(id, cover: cover);
    message.value = keptLocally ? 'TABLE_DRAFT_KEPT' : null;
    tab.value = SaleService.sellTab;
  }

  Future<bool> _parkTableDraft(String id) async {
    var saved = false;
    await register.run(() async {
      await flushCart();
      await database.parkTableDraft(
        operator.value!.id,
        installation.value!.profileId,
        id,
      );
      _parkedTableIds.add(id);
      clearCart();
      saved = true;
    });
    return saved;
  }

  bool hasParkedTable(String id) => _parkedTableIds.contains(id);

  bool canAssignTable(String id) =>
      tables.any(
        (table) => table['id'] == id && table['open_sale_id'] == null,
      ) &&
      !isHeldTable(id) &&
      !hasParkedTable(id);

  String tableStatus(Json table) {
    final id = table['id'];
    final held = heldBills.where((bill) => bill.tableId == id).firstOrNull;
    if (held != null) {
      final saved = jsonObject(jsonDecode(held.payload));
      return saved['table_status'] as String? ?? 'hold';
    }
    if (id == tableId.value || table['open_sale_id'] != null) return 'occupied';
    if (id is String && hasParkedTable(id)) return 'hold';
    final arrival = DateTime.tryParse(
      table['booking_arrival_at'] as String? ?? '',
    );
    if (arrival != null) {
      final now = DateTime.now();
      return now.isBefore(arrival.add(const Duration(hours: 2))) &&
              !now.isBefore(arrival.subtract(const Duration(minutes: 30)))
          ? 'booked'
          : 'vacant';
    }
    return switch (table['status']) {
      'occupied' ||
      'bill_requested' ||
      'hold' ||
      'booked' => table['status'] as String,
      _ => 'vacant',
    };
  }
}
