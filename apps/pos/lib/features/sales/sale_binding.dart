import 'package:get/get.dart';

import '../register/register_controller.dart';
import 'sale/sale_service.dart';
import 'sale_controller.dart';

class SaleBinding extends Bindings {
  SaleBinding(this.register);

  final RegisterController register;

  @override
  void dependencies() {
    if (!Get.isRegistered<SaleService>()) {
      Get.put<SaleService>(register.sales);
    }
    if (!Get.isRegistered<SaleController>()) {
      Get.lazyPut<SaleController>(
        () => SaleController(Get.find<SaleService>()),
      );
    }
  }
}
