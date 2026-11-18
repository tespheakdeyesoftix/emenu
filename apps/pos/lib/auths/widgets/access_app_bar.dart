import 'package:flutter/material.dart';

import '../../shared/brand_mark.dart';
import '../../ui/shared_widgets.dart';

class AccessAppBar extends StatelessWidget implements PreferredSizeWidget {
  const AccessAppBar({super.key});

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) => AppBar(
    title: const Row(
      mainAxisSize: MainAxisSize.min,
      spacing: 12,
      children: [BrandMark(size: 34), Text('eMenu POS')],
    ),
    actions: const [LanguageButton(), SizedBox(width: 16)],
  );
}
