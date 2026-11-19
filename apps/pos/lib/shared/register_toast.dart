import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import 'app_theme.dart';

bool isSuccessfulRegisterMessage(String? message) => const {
  'SAVED',
  'BILL_HELD',
  'BILL_REQUESTED',
  'ORDER_SAVED',
  'TABLE_DRAFT_KEPT',
  'PRINT_SENT',
  'POS_USERNAME_SAVED',
  'REVERSAL_SAVED',
  'REVERSAL_QUEUED',
  'MENU_RELOADED',
}.contains(message);

/// Displays register feedback without changing the workspace's layout or state.
class RegisterToastHost extends StatefulWidget {
  const RegisterToastHost({
    super.key,
    required this.message,
    required this.child,
    this.onDismissed,
    this.duration = const Duration(seconds: 4),
  });

  final String? message;
  final Widget child;
  final ValueChanged<String>? onDismissed;
  final Duration duration;

  @override
  State<RegisterToastHost> createState() => _RegisterToastHostState();
}

class _RegisterToastHostState extends State<RegisterToastHost> {
  Timer? _dismissTimer;
  String? _message;

  @override
  void initState() {
    super.initState();
    _updateMessage();
  }

  @override
  void didUpdateWidget(covariant RegisterToastHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.message != widget.message) _updateMessage();
  }

  void _updateMessage() {
    _dismissTimer?.cancel();
    _message = widget.message;
    if (_message != null) _dismissTimer = Timer(widget.duration, _dismiss);
  }

  void _dismiss() {
    _dismissTimer?.cancel();
    final dismissed = _message;
    if (!mounted || dismissed == null) return;
    setState(() => _message = null);
    widget.onDismissed?.call(dismissed);
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      widget.child,
      Positioned(
        top: 16,
        left: 16,
        right: 16,
        child: Align(
          alignment: AlignmentDirectional.topEnd,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 180),
              child: _message == null
                  ? const SizedBox.shrink()
                  : _ToastMessage(
                      key: ValueKey(_message),
                      message: _message!,
                      onDismiss: _dismiss,
                    ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _ToastMessage extends StatelessWidget {
  const _ToastMessage({
    super.key,
    required this.message,
    required this.onDismiss,
  });

  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final (background, icon) = switch (message) {
      _ when isSuccessfulRegisterMessage(message) => (
        Colors.green.shade800,
        Icons.check_circle_outline_rounded,
      ),
      'STORE_COMMAND_PENDING' ||
      'STORE_AUTHORITY_PENDING' ||
      'SHIFT_COMMAND_PENDING' ||
      'STORE_SYNC_FIRST' ||
      'SYNC_REQUIRED' ||
      'UNSYNCED_SHIFT_SALES' ||
      'UNSYNCED_DAY_SALES' ||
      'WORKING_DAY_REQUIRED' ||
      'CASHIER_SHIFT_REQUIRED' ||
      'TABLE_REQUIRED' ||
      'EMPTY_CART' ||
      'HOLD_CURRENT_BILL' ||
      'PRODUCT_PRICE_CHANGE_NOT_ALLOWED' ||
      'PRODUCT_FREE_NOT_ALLOWED' ||
      'PRODUCT_DISCOUNT_NOT_ALLOWED' ||
      'FINISH_CURRENT_ORDER' => (
        AppColors.warning,
        Icons.warning_amber_rounded,
      ),
      _ => (Colors.red.shade800, Icons.error_outline_rounded),
    };
    const foreground = Colors.white;
    return Material(
      key: const ValueKey('register-toast'),
      color: background,
      elevation: 6,
      shadowColor: colors.shadow.withValues(alpha: .12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: foreground.withValues(alpha: .12)),
      ),
      child: Semantics(
        liveRegion: true,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 6, 10),
          child: Row(
            spacing: 10,
            children: [
              Icon(icon, size: 21, color: foreground),
              Expanded(
                child: Text(
                  message.tr,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: foreground),
                ),
              ),
              IconButton(
                tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                onPressed: onDismiss,
                color: foreground,
                icon: const Icon(Icons.close_rounded, size: 18),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
