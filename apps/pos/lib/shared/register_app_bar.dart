import 'package:flutter/material.dart';

/// Keeps desktop search centered independently of the title and action widths.
class RegisterAppBar extends StatelessWidget {
  const RegisterAppBar({
    super.key,
    required this.title,
    required this.actions,
    this.leading,
    this.search,
  });

  final Widget title;
  final Widget? leading, search;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, box) {
      final heading = Row(
        spacing: 6,
        children: [
          ?leading,
          Expanded(child: title),
        ],
      );
      final controls = Align(
        alignment: AlignmentDirectional.centerEnd,
        child: Wrap(
          alignment: WrapAlignment.end,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 6,
          runSpacing: 4,
          children: actions,
        ),
      );
      if (search != null && box.maxWidth >= 600) {
        final fraction = box.maxWidth < 900 && actions.length >= 3 ? .30 : .40;
        final width = (box.maxWidth * fraction).clamp(180.0, 640.0);
        return Row(
          key: const ValueKey('register-app-bar-row'),
          spacing: 12,
          children: [
            Expanded(child: heading),
            SizedBox(
              key: const ValueKey('centered-register-search'),
              width: width,
              child: search,
            ),
            Expanded(child: controls),
          ],
        );
      }
      return Column(
        spacing: 6,
        children: [
          Row(
            spacing: 8,
            children: [
              Expanded(child: heading),
              Flexible(child: controls),
            ],
          ),
          ?search,
        ],
      );
    },
  );
}
