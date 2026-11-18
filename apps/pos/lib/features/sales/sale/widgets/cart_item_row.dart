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
    required this.total,
    required this.currency,
    required this.selected,
    required this.onSelect,
    this.actions,
  });

  final CartLine line;
  final int total;
  final String currency;
  final bool selected;
  final VoidCallback onSelect;
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
              onTap: onSelect,
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
                          if (line.isFree ||
                              (portionLabel?.isNotEmpty ?? false))
                            Wrap(
                              spacing: 4,
                              runSpacing: 3,
                              children: [
                                if (portionLabel?.isNotEmpty ?? false)
                                  _tag(context, portionLabel!),
                                if (line.isFree) _tag(context, 'cart_free'.tr),
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
                        ],
                      ),
                    ),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 100),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        spacing: 4,
                        children: [
                          Text(
                            displayAmount(total, currency),
                            style: type.titleMedium?.copyWith(
                              color: selected
                                  ? colors.onPrimaryContainer
                                  : colors.primary,
                            ),
                            textAlign: TextAlign.end,
                          ),
                          _tag(context, '${line.quantity}'),
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

  Widget _tag(BuildContext context, String label) => DecoratedBox(
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerLow,
      borderRadius: BorderRadius.circular(7),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 7),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall),
    ),
  );
}
