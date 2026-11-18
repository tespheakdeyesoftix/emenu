import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';
import '../cart_action.dart';
import '../cart_line.dart';

class CartItemActions extends GetView<SaleController> {
  const CartItemActions({super.key, required this.line});

  final CartLine line;

  @override
  Widget build(BuildContext context) => Obx(() {
    final service = controller.service;
    final editable = service.cartEditable;
    final enhanced = service.supportsCartLineEdits;
    Widget button(String label, VoidCallback? action) => OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 10),
      ),
      onPressed: editable ? action : null,
      child: Text(label.tr),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            IconButton(
              tooltip: 'cart_decrease'.tr,
              icon: const Icon(Icons.remove_circle_outline),
              onPressed: editable && line.quantity > 1
                  ? () => controller.replaceLine(
                      line,
                      line.withQuantity(line.quantity - 1),
                    )
                  : null,
            ),
            Text('${line.quantity}'),
            IconButton(
              tooltip: 'cart_increase'.tr,
              icon: const Icon(Icons.add_circle_outline),
              onPressed: editable && line.quantity < 999
                  ? () => controller.replaceLine(
                      line,
                      line.withQuantity(line.quantity + 1),
                    )
                  : null,
            ),
          ],
        ),
        Wrap(
          spacing: 5,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            button(
              'cart_price',
              enhanced && !line.isFree
                  ? () => controller.editAmount(context, line, discount: false)
                  : null,
            ),
            button('cart_qty', () => controller.editQuantity(context, line)),
            button('cart_reorder', () => service.reorderCartLine(line)),
            button('cart_delete', () => controller.deleteLine(context, line)),
            PopupMenuButton<CartAction>(
              tooltip: 'cart_more'.tr,
              enabled: editable,
              onSelected: (action) =>
                  controller.onCartAction(context, line, action),
              itemBuilder: (_) => [
                PopupMenuItem(
                  value: CartAction.edit,
                  child: Text('cart_edit_options'.tr),
                ),
                PopupMenuItem(
                  value: CartAction.free,
                  enabled: enhanced,
                  child: Text(
                    (line.isFree ? 'cart_restore_price' : 'cart_mark_free').tr,
                  ),
                ),
                PopupMenuItem(
                  value: CartAction.note,
                  enabled: enhanced,
                  child: Text('cart_note'.tr),
                ),
                PopupMenuItem(
                  value: CartAction.discount,
                  enabled: !line.isFree,
                  child: Text('cart_discount'.tr),
                ),
              ],
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 12,
                ),
                child: Text('cart_more'.tr),
              ),
            ),
          ],
        ),
      ],
    );
  });
}
