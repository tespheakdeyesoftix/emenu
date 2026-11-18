import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../core/register_database.dart';

class LoginHeader extends StatelessWidget {
  const LoginHeader({super.key, required this.title, this.installation});

  final String title;
  final RegisterInstallation? installation;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 14,
    children: [
      Text(title.tr, style: Theme.of(context).textTheme.headlineSmall),
      if (installation case final setup?) ...[
        Text('${'business'.tr}: ${setup.businessSlug}'),
        Text(
          '${'api'.tr}: ${setup.apiOrigin}',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ],
  );
}
