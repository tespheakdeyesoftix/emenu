import 'package:flutter/material.dart';

import '../../ui/shared_widgets.dart';

class LoginStatus extends StatelessWidget {
  const LoginStatus({super.key, required this.message});

  final String? message;

  @override
  Widget build(BuildContext context) => RegisterNotice(message);
}
