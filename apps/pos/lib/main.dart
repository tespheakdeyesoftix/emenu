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
  final folder = await getApplicationSupportDirectory();
  await folder.create(recursive: true);
  final database = RegisterDatabase.open(
    File('${folder.path}${Platform.pathSeparator}register.sqlite'),
  );
  Get.put(RegisterController(database));
  runApp(const PosApp());
}
