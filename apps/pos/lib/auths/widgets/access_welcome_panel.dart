import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../shared/app_theme.dart';
import '../../shared/brand_mark.dart';
import 'access_feature_list.dart';

class AccessWelcomePanel extends StatelessWidget {
  const AccessWelcomePanel({super.key});

  @override
  Widget build(BuildContext context) {
    final type = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const BrandMark(size: 76),
        const SizedBox(height: 32),
        Text(
          'register_welcome'.tr,
          style: type.headlineMedium?.copyWith(fontSize: 38),
        ),
        const SizedBox(height: 16),
        Text(
          'register_welcome_detail'.tr,
          style: type.bodyLarge?.copyWith(color: AppColors.muted),
        ),
        const SizedBox(height: 32),
        const AccessFeatureList(),
      ],
    );
  }
}
