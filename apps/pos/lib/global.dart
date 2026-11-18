import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'shared/forms/input_number_dialog_widget.dart';
import 'shared/loading_dialog_widget.dart';

const app = App();

class App {
  const App();

  static const _loadingRoute = '/app-loading';

  /// Whether the current route already displays the shared loading dialog.
  bool get isLoading =>
      Get.isRegistered<GetMaterialController>() &&
      Get.rawRoute?.isActive == true &&
      Get.rawRoute?.settings.name == _loadingRoute;

  /// Opens a blocking dialog and returns after its first frame is displayed.
  /// Close the returned handle when the operation finishes.
  Future<LoadingHandle> showLoading([String? message]) async {
    // Core operations can also run without an attached app navigator.
    if (!Get.isRegistered<GetMaterialController>() ||
        Get.key.currentState?.overlay == null) {
      return LoadingHandle._(null);
    }
    final ready = Completer<LoadingHandle>();
    final dialog = Get.dialog<void>(
      Builder(
        builder: (context) {
          if (!ready.isCompleted) {
            final route = ModalRoute.of(context)!;
            // A shared endOfFrame future may complete before this route builds.
            // Capture the route here and wait for its own first painted frame.
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (!ready.isCompleted) ready.complete(LoadingHandle._(route));
            });
          }
          return LoadingDialogWidget(message: message ?? 'loading'.tr);
        },
      ),
      barrierDismissible: false,
      transitionDuration: Duration.zero,
      name: _loadingRoute,
    );
    unawaited(
      dialog.then<void>(
        (_) {
          if (!ready.isCompleted) ready.complete(LoadingHandle._(null));
        },
        onError: (Object error, StackTrace stack) {
          if (!ready.isCompleted) ready.completeError(error, stack);
        },
      ),
    );
    return ready.future;
  }

  /// Returns an int by default, a double for [isFloat], or null on cancel.
  // ignore: non_constant_identifier_names
  Future<num?> input_number({
    required String title,
    bool isFloat = false,
    num? value,
    num? min,
    num? max,
    String? label,
    String? confirmText,
  }) {
    if ([value, min, max].any((number) => number != null && !number.isFinite)) {
      throw ArgumentError('Number values and limits must be finite.');
    }
    if (min != null && max != null && min > max) {
      throw ArgumentError('The minimum must not exceed the maximum.');
    }
    if (!isFloat && value != null && value.toInt() != value) {
      throw ArgumentError.value(
        value,
        'value',
        'Integer input needs a whole number.',
      );
    }
    return Get.dialog<num>(
      InputNumberDialogWidget(
        title: title,
        isFloat: isFloat,
        value: value,
        min: min,
        max: max,
        label: label,
        confirmText: confirmText,
      ),
    );
  }
}

class LoadingHandle {
  LoadingHandle._(this._route);

  final Route<dynamic>? _route;
  bool _closed = false;

  /// Closes only this loading dialog. Repeated calls are safe.
  void close() {
    if (_closed) return;
    _closed = true;
    final route = _route;
    final navigator = route?.navigator;
    if (route == null ||
        navigator == null ||
        !navigator.mounted ||
        !route.isActive) {
      return;
    }
    if (route.isCurrent) {
      navigator.pop();
    } else {
      final visibleRoute = Get.rawRoute;
      final dialogOpen = Get.isDialogOpen;
      final bottomSheetOpen = Get.isBottomSheetOpen;
      navigator.removeRoute(route);
      // GetX 4 clears overlay flags when removing a covered dialog, even
      // though another overlay is still visible. Preserve that route's state.
      if (visibleRoute?.isCurrent == true) {
        Get.routing.update((routing) {
          routing.route = visibleRoute;
          routing.isDialog = dialogOpen;
          routing.isBottomSheet = bottomSheetOpen;
        });
      }
    }
  }
}
