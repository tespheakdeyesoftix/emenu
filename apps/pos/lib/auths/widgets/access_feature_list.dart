import 'package:flutter/material.dart';
import 'package:get/get.dart';

class AccessFeatureList extends StatelessWidget {
  const AccessFeatureList({super.key});

  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 10,
    runSpacing: 10,
    children: [
      for (final (icon, label) in const [
        (Icons.point_of_sale_outlined, 'sell'),
        (Icons.table_restaurant_outlined, 'tables'),
        (Icons.schedule, 'shift'),
      ])
        Chip(avatar: Icon(icon, size: 17), label: Text(label.tr)),
    ],
  );
}
