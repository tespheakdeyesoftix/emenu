part of 'sale_service.dart';

extension SaleReversalMethods on SaleService {
  bool canReverseSale(LocalSale sale) {
    final role = operator.value?.role;
    return (role == 'owner' || role == 'manager') &&
        (context['capabilities'] as Map?)?['reversal_context_guard'] == true &&
        !busy.value &&
        !commandPending.value &&
        !storeAuthorityPending &&
        context['read_only'] != true &&
        sale.reversesSaleId == null &&
        sale.total >= 0 &&
        !pending.any((row) => row.$1.reversesSaleId == sale.id) &&
        (storeOperations
            ? (!paired.value || online.value)
            : (!paired.value && online.value && sale.settlement != null));
  }

  Future<void> reverseSale(
    LocalSale sale,
    String reason,
    Json expectedContext,
  ) async {
    if (!canReverseSale(sale)) {
      message.value = 'SALE_NOT_REVERSIBLE';
      return;
    }
    await register.run(() async {
      if (!storeOperations) {
        final api = register.api;
        final saved = jsonObject(jsonDecode(sale.settlement!));
        final original = await register.access.withSession(
          api,
          operator.value!.id,
          (token) => api.request(
            ApiEndpoint.saleById(saved['id'] as String),
            token: token,
          ),
        );
        if (original['reversed_by_sale_id'] != null) {
          throw const PosApiError(
            409,
            'SALE_ALREADY_REVERSED',
            'This sale already has a reversal.',
          );
        }
      }
      await register.sendCommand(RegisterAction.reverseSale, {
        'sale_id': sale.id,
        'reason': reason,
        'expected_context': expectedContext,
      });
      if (storeOperations) {
        await register.refreshAfterStoreOperation();
        message.value = 'REVERSAL_SAVED';
      } else {
        message.value = 'REVERSAL_QUEUED';
      }
      register.wakeSaleSync();
    });
  }
}
