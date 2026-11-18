part of '../sale_controller.dart';

extension TableViewMethods on SaleController {
  Future<void> openTable(BuildContext context, Json table) async {
    if (openingTable.value || !service.cartEditable) return;
    openingTable.value = true;
    LoadingHandle? loading;
    try {
      final id = table['id'] as String;
      final held = service.isHeldTable(id) || service.hasParkedTable(id);
      final current = service.tableId.value == id;
      int? cover;
      if (!held && !current && service.canAssignTable(id)) {
        if (service.promptGuestCover) {
          cover = await inputGuestCover(table, table['booking_pax'] as int?);
          if (cover == null || !context.mounted) return;
        } else if (service.tableStatus(table) == 'booked') {
          final seat = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: Text(tableLabel(table)),
              content: Text('seat_booked_table'.tr),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('back'.tr),
                ),
                RegisterButton(
                  'seat_table',
                  onPressed: () => Navigator.pop(context, true),
                ),
              ],
            ),
          );
          if (seat != true || !context.mounted) return;
        }
      }
      if (!context.mounted || isClosed) return;
      loading = await app.showLoading();
      if (!context.mounted || isClosed) return;
      await service.openTable(id, cover: cover);
    } finally {
      loading?.close();
      openingTable.value = false;
    }
  }

  Future<void> chooseTable(BuildContext context, String? id) async {
    final table = service.tables.where((row) => row['id'] == id).firstOrNull;
    if (table != null &&
        service.promptGuestCover &&
        id != service.tableId.value) {
      final cover = await inputGuestCover(table, table['booking_pax'] as int?);
      if (!context.mounted) return;
      if (cover == null || !service.canAssignTable(id!)) {
        tablePickerVersion.value++;
        return;
      }
      service.selectTable(id, cover: cover);
    } else {
      service.selectTable(id);
    }
  }

  Future<void> editGuestCover(BuildContext context, Json table) async {
    final id = table['id'] as String;
    final cover = await inputGuestCover(table, service.guestCover.value);
    if (context.mounted && cover != null && service.tableId.value == id) {
      service.selectTable(id, cover: cover);
    }
  }

  Future<int?> inputGuestCover(Json table, int? value) async =>
      (await app.input_number(
        title: tableLabel(table),
        value: value,
        min: 1,
        max: 1000,
        label: 'guest_cover'.tr,
        confirmText: 'seat_table'.tr,
      ))?.toInt();
}
