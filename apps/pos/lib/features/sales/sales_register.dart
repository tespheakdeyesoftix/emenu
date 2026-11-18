import 'package:get/get.dart';

import '../../core/pos_api.dart';
import '../../core/register_access.dart';
import '../../core/register_authority.dart';
import '../../core/register_database.dart';

/// Register infrastructure used by sales, shared by standalone and paired tills.
abstract interface class SalesRegister {
  static const sellTab = 0, tablesTab = 3;

  RegisterDatabase get database;
  RegisterAccess get access;
  PosApi get api;
  Rxn<RegisterInstallation> get installation;
  Rxn<RegisterOperator> get operator;
  Rxn<Json> get snapshot;
  RxBool get busy;
  RxBool get commandPending;
  RxBool get paired;
  RxBool get online;
  RxnString get message;
  RxInt get tab;
  RxList<HeldBill> get heldBills;
  RxList<(LocalSale, SaleOutboxData)> get pending;
  Json get context;
  Json get config;
  Json get operatingContext;
  List<Json> get products;
  List<Json> get tables;
  List<Json> get customers;
  bool get storeOperations;
  bool get storeAuthorityPending;
  bool get needsOperatingSetup;

  Future<Json> readSalesHistory(
    String operatorId, {
    int? serverPage,
    String? saleId,
  });
  Future<void> run(Future<void> Function() action);
  Future<bool> reloadMenu();
  Future<void> sendCommand(RegisterAction action, Json body);
  Future<void> refreshAfterStoreOperation();
  void wakeSaleSync();
  void showError(Object error);
  void selectTab(int destination);
}
