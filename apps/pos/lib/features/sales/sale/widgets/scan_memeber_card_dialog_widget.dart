import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../../../shared/forms/customer_code_field.dart';
import '../customer/customer_dialog_controller.dart';
import '../customer/customer_directory.dart';
import 'customer_dialog_header.dart';
import 'member_card_camera.dart';

class ScanMemeberCardDialogWidget extends StatefulWidget {
  const ScanMemeberCardDialogWidget({
    super.key,
    required this.directory,
    required this.useCamera,
  });

  final CustomerDirectory directory;
  final bool useCamera;

  @override
  State<ScanMemeberCardDialogWidget> createState() =>
      _ScanMemberCardDialogState();
}

class _ScanMemberCardDialogState extends State<ScanMemeberCardDialogWidget> {
  late final controller = CustomerDialogController(widget.directory);
  bool manualEntry = false;
  bool completed = false;

  void submit(String code) {
    if (completed || !mounted || ModalRoute.of(context)?.isCurrent != true) {
      return;
    }
    final customer = controller.resolveCode(code);
    if (customer == null) return;
    completed = true;
    Navigator.pop(context, customer['id'] as String);
  }

  @override
  void dispose() {
    controller.onClose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final showCamera = widget.useCamera && !manualEntry;
    return Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const CustomerDialogHeader(
                title: 'scan_customer',
                icon: Icons.qr_code_scanner_rounded,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 16,
                  children: [
                    Text(
                      (showCamera
                              ? 'customer_camera_hint'
                              : 'customer_scanner_hint')
                          .tr,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (showCamera) ...[
                      MemberCardCamera(onScan: submit),
                      Obx(() {
                        final error = controller.scanError.value;
                        return error == null
                            ? const SizedBox.shrink()
                            : Semantics(
                                liveRegion: true,
                                child: Text(
                                  error.tr,
                                  style: TextStyle(
                                    color: Theme.of(context).colorScheme.error,
                                  ),
                                ),
                              );
                      }),
                      TextButton.icon(
                        onPressed: () => setState(() {
                          controller.scanError.value = null;
                          manualEntry = true;
                        }),
                        icon: const Icon(Icons.keyboard_outlined, size: 20),
                        label: Text('customer_enter_code'.tr),
                      ),
                    ] else ...[
                      Obx(
                        () => CustomerCodeField(
                          controller: controller.codeInput,
                          focusNode: controller.scannerFocus,
                          error: controller.scanError.value,
                          onChanged: (_) => controller.scanError.value = null,
                          onSubmitted: submit,
                        ),
                      ),
                      FilledButton.icon(
                        onPressed: () => submit(controller.codeInput.text),
                        icon: const Icon(Icons.check_rounded, size: 20),
                        label: Text('select_customer'.tr),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
