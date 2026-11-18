import 'package:flutter/material.dart';

import 'app_theme.dart';

class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    this.size = 42,
    this.backgroundColor = AppColors.secondaryContainer,
    this.foregroundColor = AppColors.primary,
  });

  final double size;
  final Color backgroundColor, foregroundColor;

  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: backgroundColor,
      borderRadius: BorderRadius.circular(size * .3),
    ),
    child: Icon(
      Icons.point_of_sale_rounded,
      color: foregroundColor,
      size: size * .53,
    ),
  );
}
