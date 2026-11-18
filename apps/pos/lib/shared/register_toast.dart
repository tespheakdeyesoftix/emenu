import 'dart:async';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

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
    this.duration = const Duration(seconds: 4),
  });

  final String? message;
  final Widget child;
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
    if (mounted) setState(() => _message = null);
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
    final success = isSuccessfulRegisterMessage(message);
    final pending = message == 'STORE_COMMAND_PENDING';
    final foreground = success
        ? colors.onPrimaryContainer
        : pending
        ? colors.onSecondaryContainer
        : colors.onErrorContainer;
    final background = success
        ? colors.primaryContainer
        : pending
        ? colors.secondaryContainer
        : colors.errorContainer;
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
              Icon(
                success
                    ? Icons.check_circle_outline_rounded
                    : pending
                    ? Icons.hourglass_empty_rounded
                    : Icons.info_outline_rounded,
                size: 21,
                color: foreground,
              ),
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
