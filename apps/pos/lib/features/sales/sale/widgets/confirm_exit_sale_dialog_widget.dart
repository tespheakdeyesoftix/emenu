import 'package:flutter/material.dart';
import 'package:get/get.dart';

enum SaleExitChoice { hold, submit, continueWithoutSaving }

class ConfirmExitSaleDialogWidget extends StatelessWidget {
  const ConfirmExitSaleDialogWidget({super.key, required this.canSubmit});

  final bool canSubmit;

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text('exit_sale_title'.tr),
    content: Text('exit_sale_message'.tr),
    actions: [
      OutlinedButton(
        onPressed: () => Navigator.pop(context, SaleExitChoice.hold),
        child: Text('exit_hold_order'.tr),
      ),
      FilledButton(
        onPressed: canSubmit
            ? () => Navigator.pop(context, SaleExitChoice.submit)
            : null,
        child: Text('exit_submit_order'.tr),
      ),
      TextButton(
        onPressed: () =>
            Navigator.pop(context, SaleExitChoice.continueWithoutSaving),
        child: Text('exit_continue'.tr),
      ),
    ],
  );
}
