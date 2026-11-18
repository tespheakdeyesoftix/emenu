import 'package:get/get.dart';

import '../features/register/register_controller.dart';
import 'login_controller.dart';
import 'login_service.dart';

class LoginBinding extends Bindings {
  LoginBinding(this.register);

  final RegisterController register;

  @override
  void dependencies() {
    if (!Get.isRegistered<LoginService>()) {
      Get.put<LoginService>(LoginService(register));
    }
    if (!Get.isRegistered<LoginController>()) {
      Get.lazyPut<LoginController>(
        () => LoginController(Get.find<LoginService>()),
        fenix: true,
      );
    }
  }
}
