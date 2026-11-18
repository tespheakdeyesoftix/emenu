import 'package:flutter/material.dart';

import '../../shared/surface_card.dart';
import 'access_app_bar.dart';
import 'access_welcome_panel.dart';

class AccessLayout extends StatelessWidget {
  const AccessLayout({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: const AccessAppBar(),
    body: LayoutBuilder(
      builder: (context, box) => Center(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(box.maxWidth >= 900 ? 40 : 20),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1060),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (box.maxWidth >= 900) ...[
                  const Expanded(child: AccessWelcomePanel()),
                  const SizedBox(width: 72),
                ],
                Flexible(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 440),
                    child: SurfaceCard(
                      padding: EdgeInsets.all(box.maxWidth >= 600 ? 32 : 22),
                      child: child,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
