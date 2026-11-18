import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:path_provider/path_provider.dart';
import 'package:timezone/data/latest_all.dart' as timezones;

import 'core/register_database.dart';
import 'features/register/register_controller.dart';
import 'ui/register_app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  timezones.initializeTimeZones();
  final support = await getApplicationSupportDirectory();
  const dataProfile = String.fromEnvironment('POS_DATA_PROFILE');
  if (dataProfile.isNotEmpty &&
      !RegExp(r'^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$').hasMatch(dataProfile)) {
    throw ArgumentError.value(
      dataProfile,
      'POS_DATA_PROFILE',
      'Use up to 64 letters, digits, hyphens, or underscores.',
    );
  }
  final folder = dataProfile.isEmpty
      ? support
      : Directory('${support.path}${Platform.pathSeparator}$dataProfile');
  await folder.create(recursive: true);
  final database = RegisterDatabase.open(
    File('${folder.path}${Platform.pathSeparator}register.sqlite'),
  );
  Get.put(RegisterController(database));
  runApp(const PosApp());
}
