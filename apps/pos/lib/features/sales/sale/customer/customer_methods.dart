part of '../../sale_controller.dart';

extension SaleCustomerMethods on SaleController {
  Future<void> chooseCustomer(BuildContext context) async {
    if (!service.cartEditable) return;
    final id = await showDialog<String>(
      context: context,
      builder: (_) => SelectCustomerDialogWidget(
        directory: service.customerDirectory,
        selectedId: service.effectiveCustomerId,
        defaultId: service.defaultCustomerId,
      ),
    );
    if (context.mounted && !isClosed && id != null) _applyCustomer(id);
  }

  Future<void> scanCustomer(BuildContext context) async {
    if (!service.cartEditable) return;
    final platform = Theme.of(context).platform;
    final id = await showDialog<String>(
      context: context,
      builder: (_) => ScanMemeberCardDialogWidget(
        directory: service.customerDirectory,
        useCamera:
            platform == TargetPlatform.android ||
            platform == TargetPlatform.iOS,
      ),
    );
    if (context.mounted && !isClosed && id != null) _applyCustomer(id);
  }

  void _applyCustomer(String id) {
    if (!service.cartEditable) return;
    if (service.customerDirectory.byId(id) == null) {
      service.message.value = 'customer_unavailable';
      return;
    }
    service.selectCustomer(id);
  }
}
