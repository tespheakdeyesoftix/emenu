import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../features/register/register_controller.dart';
import 'login_service.dart';

class LoginController extends GetxController {
  LoginController(this.service);

  static const pinLength = 6;
  static const defaultOrigin = String.fromEnvironment(
    'POS_API_ORIGIN',
    defaultValue: 'http://127.0.0.1:8787',
  );

  final LoginService service;
  final origin = TextEditingController(text: defaultOrigin);
  final slug = TextEditingController();
  final account = TextEditingController();
  final password = TextEditingController();
  final pin = TextEditingController();
  final staffId = RxnString();
  final profileId = RxnString();
  final usePassword = false.obs;
  Worker? _stageWorker;

  RegisterController get register => service.register;
  bool get busy => register.busy.value;
  bool get choosingProfile =>
      register.stage.value == RegisterStage.selectProfile;
  bool get showPassword =>
      register.installation.value == null ||
      usePassword.value ||
      register.staff.isEmpty;
  String get title => choosingProfile
      ? 'select_profile'
      : register.installation.value == null
      ? 'activate'
      : 'sign_in';

  String? get selectedStaffId {
    final selected = staffId.value;
    return register.staff.any((user) => user.id == selected)
        ? selected
        : register.staff.firstOrNull?.id;
  }

  String? get selectedProfileId {
    final selected = profileId.value;
    return service.profiles.any((profile) => profile['id'] == selected)
        ? selected
        : service.profiles.firstOrNull?['id'] as String?;
  }

  @override
  void onInit() {
    super.onInit();
    _resetForm(prefill: true);
    _stageWorker = ever(register.stage, (stage) {
      if (stage == RegisterStage.ready) {
        _resetForm();
      } else if (stage == RegisterStage.locked ||
          stage == RegisterStage.activation) {
        _resetForm(prefill: true);
      } else if (stage == RegisterStage.selectProfile) {
        profileId.value = null;
      }
    });
  }

  Future<void> signIn() async {
    if (busy) return;
    final setup = register.installation.value;
    await service.signIn(
      setup?.apiOrigin ?? origin.text,
      setup?.businessSlug ?? slug.text,
      account.text,
      password.text,
    );
    if (!isClosed) password.clear();
  }

  Future<void> selectProfile() async {
    final selected = selectedProfileId;
    if (busy || selected == null) return;
    await service.selectProfile(selected);
  }

  void cancelProfileSelection() {
    if (busy) return;
    profileId.value = null;
    pin.clear();
    service.cancelSignIn();
  }

  void selectStaff(String? id) {
    if (busy) return;
    pin.clear();
    staffId.value = id;
  }

  void selectProfileId(String? id) {
    if (!busy) profileId.value = id;
  }

  void showPasswordLogin() {
    if (busy) return;
    pin.clear();
    usePassword.value = true;
  }

  void showPinLogin() {
    if (busy) return;
    password.clear();
    usePassword.value = false;
  }

  Future<void> unlock() async {
    final selected = selectedStaffId;
    if (busy || selected == null || pin.text.length != pinLength) return;
    await service.unlock(selected, pin.text);
    if (!isClosed) pin.clear();
  }

  void editPin(String? digit) {
    if (busy || selectedStaffId == null) return;
    if (digit != null && !RegExp(r'^\d$').hasMatch(digit)) return;
    final value = pin.value;
    final selection = value.selection;
    var start = selection.isValid ? selection.start : value.text.length;
    final end = selection.isValid ? selection.end : value.text.length;
    if (digit == null && start == end && start > 0) start--;
    final replacement = digit ?? '';
    final next = value.text.replaceRange(start, end, replacement);
    if (next.length > pinLength) return;
    pin.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + replacement.length),
    );
  }

  void _resetForm({bool prefill = false}) {
    origin.text = defaultOrigin;
    for (final input in [slug, account, password, pin]) {
      input.clear();
    }
    staffId.value = null;
    profileId.value = null;
    usePassword.value = false;
    if (!prefill || !kDebugMode) return;
    final setup = register.installation.value;
    final apiHost = Uri.tryParse(setup?.apiOrigin ?? '')?.host;
    if (setup?.businessSlug == 'pheakdey-backery' &&
        const {'localhost', '127.0.0.1', '::1'}.contains(apiHost)) {
      account.text = 'cashier@pheakdey-backery.example.test';
      password.text = '12345678';
      usePassword.value = true;
    }
  }

  @override
  void onClose() {
    _stageWorker?.dispose();
    for (final input in [origin, slug, account, password, pin]) {
      input.dispose();
    }
    super.onClose();
  }
}
