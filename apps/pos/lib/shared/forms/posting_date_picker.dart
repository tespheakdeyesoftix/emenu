import 'package:flutter/material.dart';
import 'package:get/get.dart';

Future<DateTime?> showPostingDatePicker(
  BuildContext context,
  DateTime initial,
) => showDatePicker(
  context: context,
  initialDate: initial,
  firstDate: DateTime(1),
  lastDate: DateTime(9999, 12, 31),
  helpText: 'posting_date'.tr,
);
