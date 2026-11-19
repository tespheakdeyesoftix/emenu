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
    final colors = Theme.of(context).colorScheme;
    PopupMenuItem<CartAction> menuItem(
      CartAction action,
      IconData icon,
      String label, {
      bool enabled = true,
    }) => PopupMenuItem<CartAction>(
      value: action,
      enabled: enabled,
      child: Row(
        spacing: 12,
        children: [
          Icon(icon, size: 18, color: enabled ? null : Theme.of(context).disabledColor),
          Flexible(child: Text(label.tr)),
        ],
      ),
    );
    Widget button(String label, VoidCallback? action, {bool danger = false}) => Expanded(
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          backgroundColor: danger && editable ? colors.error : null,
          foregroundColor: danger && editable ? colors.onError : null,
          side: danger && editable ? BorderSide.none : null,
          padding: const EdgeInsets.symmetric(horizontal: 3),
          minimumSize: const Size(0, 34),
          shape: const StadiumBorder(),
        ),
        onPressed: editable ? action : null,
        child: Text(label.tr, textAlign: TextAlign.center),
      ),
    );
    return Row(
      spacing: 4,
      children: [
        button(
          'cart_price',
          enhanced && !line.isFree && service.allowsAction("allow_change_product_price")
              ? () => controller.editPrice(context, line)
              : null,
        ),
        button(
          'cart_qty',
          line.canEditQuantity ? () => controller.editQuantity(context, line) : null,
        ),
        button(
          'cart_reorder',
          line.canEditQuantity && line.quantity + 1 > 999
              ? null
              : () => controller.reorderLine(line),
        ),
        button('cart_delete', () => controller.deleteLine(context, line), danger: true),
        PopupMenuButton<CartAction>(
          tooltip: 'cart_more'.tr,
          enabled: editable,
          onSelected: (action) =>
              controller.onCartAction(context, line, action),
          itemBuilder: (_) => [
            menuItem(CartAction.edit, Icons.tune_rounded, 'cart_edit_options'),
            menuItem(
              CartAction.free,
              line.isFree ? Icons.undo_rounded : Icons.card_giftcard_outlined,
              line.isFree ? 'cart_restore_price' : 'cart_mark_free',
              enabled: service.allowsAction('allow_free_item') && (line.isFree ? enhanced : service.supportsFreeItemReasons),
            ),
            menuItem(
              CartAction.note,
              Icons.edit_note_rounded,
              'cart_note',
              enabled: enhanced,
            ),
            menuItem(
              CartAction.discount,
              line.hasDiscount ? Icons.undo_rounded : Icons.percent_rounded,
              line.hasDiscount ? 'cart_cancel_discount' : 'cart_discount',
              enabled: service.allowsAction('allow_discount_on_item') && (line.hasDiscount ||
                  (!line.isFree && service.supportsItemDiscountDetails)),
            ),
          ],
          icon: const Icon(Icons.more_horiz),
        ),
      ],
    );
  });
}
