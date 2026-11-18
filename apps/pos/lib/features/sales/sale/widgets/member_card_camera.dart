import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class MemberCardCamera extends StatefulWidget {
  const MemberCardCamera({super.key, required this.onScan});

  final ValueChanged<String> onScan;

  @override
  State<MemberCardCamera> createState() => _MemberCardCameraState();
}

class _MemberCardCameraState extends State<MemberCardCamera>
    with WidgetsBindingObserver {
  final camera = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!camera.value.hasCameraPermission) return;
    if (state == AppLifecycleState.resumed) {
      unawaited(camera.start());
    } else {
      unawaited(camera.stop());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(camera.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(12),
    child: AspectRatio(
      aspectRatio: 4 / 3,
      child: LayoutBuilder(
        builder: (context, bounds) {
          final window = Rect.fromCenter(
            center: bounds.biggest.center(Offset.zero),
            width: bounds.maxWidth * .85,
            height: math.min(bounds.maxHeight * .7, bounds.maxWidth * .65),
          );
          return MobileScanner(
            controller: camera,
            useAppLifecycleState: false,
            scanWindow: window,
            tapToFocus: true,
            onDetect: (capture) {
              final code = capture.barcodes
                  .map((barcode) => barcode.rawValue?.trim())
                  .whereType<String>()
                  .where((code) => code.isNotEmpty)
                  .firstOrNull;
              if (code != null) widget.onScan(code);
            },
            placeholderBuilder: (_) => const _CameraStatus(
              icon: Icons.camera_alt_outlined,
              message: 'customer_camera_starting',
            ),
            errorBuilder: (_, error) => _CameraStatus(
              icon: Icons.no_photography_outlined,
              message:
                  error.errorCode == MobileScannerErrorCode.permissionDenied
                  ? 'customer_camera_permission'
                  : 'customer_camera_unavailable',
            ),
            overlayBuilder: (_, _) => Center(
              child: Container(
                width: window.width,
                height: window.height,
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.white, width: 2),
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          );
        },
      ),
    ),
  );
}

class _CameraStatus extends StatelessWidget {
  const _CameraStatus({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: Theme.of(context).colorScheme.surfaceContainerHighest,
    child: Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 12,
          children: [
            Icon(icon, size: 32),
            Text(message.tr, textAlign: TextAlign.center),
          ],
        ),
      ),
    ),
  );
}
