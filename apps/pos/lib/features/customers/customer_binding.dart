import 'package:get/get.dart';

import '../register/register_controller.dart';
import 'customer_controller.dart';
import 'customer_service.dart';

class CustomerBinding extends Bindings {
  CustomerBinding(this.register);

  final RegisterController register;

  @override
  void dependencies() {
    if (!Get.isRegistered<CustomerService>()) {
      Get.put(CustomerService(register));
    }
    if (!Get.isRegistered<CustomerController>()) {
      Get.lazyPut(() => CustomerController(Get.find<CustomerService>()));
    }
  }
}
