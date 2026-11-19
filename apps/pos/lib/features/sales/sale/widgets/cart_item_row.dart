import '../../../../helpers/helper.dart';

import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../cart_line.dart';
import '../../../../core/pricing.dart';
import '../../../../shared/network_cached_image_widget.dart';
import '../../../../shared/app_theme.dart';

class CartItemRow extends StatelessWidget {
  const CartItemRow({
    super.key,
    required this.line,
    required this.statusColor,
    required this.amountAfterDiscount,
    required this.discountAmount,
    required this.currency,
    required this.selected,
    required this.onSelect,
    required this.onQuantity,
    required this.onEditQuantity,
    this.actions,
  });

  final CartLine line;
  final Color statusColor;
  final int amountAfterDiscount;
  final int discountAmount;
  final String currency;
  final bool selected;
  final VoidCallback onSelect;
  final ValueChanged<num>? onQuantity;
  final VoidCallback? onEditQuantity;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final type = theme.textTheme;
    final name = line.name(Get.locale?.languageCode ?? 'km');
    final code = line.product['code']?.toString().trim();
    final portion = line.portion;
    final portionLabel = portion == null
        ? line.product['unit']?.toString().trim()
        : catalogLabel(portion);
    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      color: selected ? AppColors.selectedCard : AppColors.card,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: selected ? colors.primary : AppColors.cardOutline,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            selected: selected,
            child: InkWell(
              onTap: line.voided ? null : onSelect,
              child: Padding(
                padding: const EdgeInsets.all(10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 9,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: SizedBox.square(
                        dimension: 42,
                        child: NetworkCachedImageWidget(
                          imageUrl: line.product['image_url']?.toString(),
                          cacheWidth: 96,
                          label: name,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        spacing: 3,
                        children: [
                          Text(
                            code == null || code.isEmpty || code == name
                                ? name
                                : '$code · $name',
                            style: type.titleSmall,
                          ),
                          Wrap(
                            spacing: 4,
                            runSpacing: 3,
                            children: [
                              _tag(
                                context,
                                (line.voided
                                        ? 'sales_void'
                                        : line.submitted
                                        ? 'sales_submitted'
                                        : 'cart_new_line')
                                    .tr,
                                color: statusColor,
                              ),
                              if (portionLabel?.isNotEmpty ?? false)
                                _tag(context, portionLabel!),
                              if (line.isFree)
                                _tag(
                                  context,
                                  'cart_free'.tr,
                                  color: AppColors.success,
                                ),
                            ],
                          ),
                          Text(
                            '${line.quantity} × ${displayAmount(line.unit, currency)}',
                            style: type.bodySmall?.copyWith(
                              color: selected
                                  ? colors.onPrimaryContainer
                                  : AppColors.cardMuted,
                            ),
                          ),
                          if (line.modifiers.isNotEmpty)
                            Text(
                              line.modifiers
                                  .map((option) {
                                    final label = catalogLabel(option);
                                    final price = option['price_minor'] as int;
                                    return price == 0 || line.isFree
                                        ? label
                                        : '$label (${displayAmount(price, currency)})';
                                  })
                                  .join(', '),
                              style: type.bodySmall,
                            ),
                          if (line.note != null)
                            Text(line.note!, style: type.bodySmall),
                          if (line.hasDiscount)
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(text: "${'cart_discount'.tr} · "),
                                  TextSpan(
                                    text: displayAmount(-discountAmount, currency),
                                    style: TextStyle(color: colors.error),
                                  ),
                                  if (line.discountNote case final note?)
                                    TextSpan(text: ' · $note'),
                                ],
                              ),
                              style: type.bodySmall,
                            ),
                          if (line.freeReason case final reason?)
                            Text('${'cart_free'.tr} · $reason', style: type.bodySmall),
                          if (line.order['void_reason']
                              case final String reason)
                            Text(reason, style: type.bodySmall),
                        ],
                      ),
                    ),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 128),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        spacing: 4,
                        children: [
                          Text(
                            displayAmount(amountAfterDiscount, currency),
                            style: type.titleMedium?.copyWith(
                              decoration: line.voided
                                  ? TextDecoration.lineThrough
                                  : null,
                              color: selected
                                  ? colors.onPrimaryContainer
                                  : colors.primary,
                            ),
                            textAlign: TextAlign.end,
                          ),
                          if (!line.voided)
                            DecoratedBox(
                              decoration: ShapeDecoration(
                                shape: StadiumBorder(
                                  side: BorderSide(
                                    color: colors.outlineVariant,
                                  ),
                                ),
                                color: colors.surface,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  _step(-1),
                                  Flexible(
                                    child: InkWell(
                                      onTap: onEditQuantity,
                                      child: ConstrainedBox(
                                        constraints: const BoxConstraints(minWidth: 20, minHeight: 32),
                                        child: Center(
                                          widthFactor: 1,
                                          child: FittedBox(
                                            fit: BoxFit.scaleDown,
                                            child: Text(
                                              '${line.quantity}',
                                              style: type.labelLarge?.copyWith(
                                                fontWeight: FontWeight.w700,
                                                color: onEditQuantity == null ? theme.disabledColor : null,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  _step(1),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (actions != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
              child: actions,
            ),
        ],
      ),
    );
  }

  Widget _step(int delta) => IconButton(
    style: IconButton.styleFrom(
      minimumSize: Size.zero,
      fixedSize: const Size.square(32),
      visualDensity: VisualDensity.standard,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    ),
    padding: EdgeInsets.zero,
    tooltip: (delta < 0 ? 'cart_decrease' : 'cart_increase').tr,
    icon: Icon(delta < 0 ? Icons.remove : Icons.add, size: 16),
    onPressed:
        onQuantity != null &&
            validSaleQuantity(normalizedQuantity(line.quantity + delta))
        ? () => onQuantity!(normalizedQuantity(line.quantity + delta))
        : null,
  );

  Widget _tag(BuildContext context, String label, {Color? color}) =>
      DecoratedBox(
        decoration: BoxDecoration(
          color: color ?? Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 7),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color == null
                  ? null
                  : color.computeLuminance() > 0.179
                  ? Colors.black
                  : Colors.white,
              fontWeight: color == null ? null : FontWeight.w700,
            ),
          ),
        ),
      );
}
