import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderAbstractViewport;
import 'package:get/get.dart';

import '../../sale_controller.dart';
import '../../table/widgets/table_status_label.dart' show tableStatusColor;
import '../../../../core/pos_api.dart' show Json;
import '../../../../core/pricing.dart' show defaultTaxRule;
import '../../../../shared/app_theme.dart';
import '../cart_line.dart';
import '../sale_service.dart' show HeldBillMethods;
import 'cart_footer.dart';
import 'cart_header.dart';
import 'cart_item_actions.dart';
import 'cart_item_row.dart';
import 'cart_summary.dart';
import '../../../../shared/empty_state_widget.dart';

class SaleCart extends GetView<SaleController> {
  const SaleCart({super.key});

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, layout) => Obx(() {
      final service = controller.service;
      final totals = service.cart.map(service.previewTotalOf).toList();
      final groups = <String, List<CartLine>>{};
      for (final line in [...service.cart, ...service.voidedLines]) {
        (groups[line.session] ??= []).add(line);
      }
      final sessions = groups.values.toList()
        ..sort((a, b) {
          if (a.first.session == 'current') {
            return b.first.session == 'current' ? 0 : -1;
          }
          if (b.first.session == 'current') return 1;
          return (a.first.order['ordered_at'] as String? ?? '').compareTo(
            b.first.order['ordered_at'] as String? ?? '',
          );
        });
      final selected = controller.selectedLine.value;
      final compact =
          layout.maxHeight < 520 ||
          MediaQuery.textScalerOf(context).scale(14) > 18;
      final items = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (compact)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: CartHeader(),
            ),
          if (sessions.isEmpty)
            EmptyStateWidget(
              icon: Icons.shopping_bag_outlined,
              title: 'cart_empty'.tr,
              description: 'cart_empty_detail'.tr,
            ),
          for (final group in sessions)
            _CartGroup(
              key: ValueKey((service.billGeneration, group.first.session)),
              lines: group,
              selected: group.contains(selected) ? selected : null,
              controller: controller,
            ),
        ],
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 8,
        children: [
          if (!compact) const CartHeader(),
          Expanded(
            child: LayoutBuilder(
              builder: (context, viewport) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: viewport.maxHeight),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      items,
                      if (totals.isNotEmpty)
                        CartSummary(
                          amounts: totals,
                          taxRule: defaultTaxRule(service.quoteConfig),
                          currency: service.currency,
                          needsDiscountReview: service.needsDiscountReview,
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          const CartFooter(),
        ],
      );
    }),
  );
}

class _CartGroup extends StatefulWidget {
  const _CartGroup({
    super.key,
    required this.lines,
    required this.selected,
    required this.controller,
  });

  final List<CartLine> lines;
  final CartLine? selected;
  final SaleController controller;

  @override
  State<_CartGroup> createState() => _CartGroupState();
}

class _CartGroupState extends State<_CartGroup> {
  bool expanded = true;

  @override
  void didUpdateWidget(_CartGroup oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.selected != null &&
        !identical(widget.selected, oldWidget.selected)) {
      expanded = true;
    }
  }

  @override
  Widget build(BuildContext context) => Obx(() {
    final controller = widget.controller;
    final service = controller.service;
    final editable = service.cartEditable;
    final first = widget.lines.first;
    final orderedAt = widget.lines
        .map((line) => line.order['ordered_at'])
        .whereType<String>()
        .map(DateTime.tryParse)
        .whereType<DateTime>()
        .firstOrNull;
    final submitted = first.submitted || first.voided;
    final at = (orderedAt ?? (submitted ? service.activeBillSavedAt : null))
        ?.toLocal();
    final format = MaterialLocalizations.of(context);
    final label = [
      if (orderedAt == null)
        (submitted ? 'sales_submitted' : 'cart_current_order').tr,
      if (at != null) ...[
        format.formatShortDate(at),
        format.formatTimeOfDay(TimeOfDay.fromDateTime(at)),
      ],
      if ((first.order['ordered_by_name'] ??
              service.operator.value?.displayName)
          case final String name)
        name,
    ].join(' · ');
    final theme = Theme.of(context);
    final ink = theme.colorScheme.onInverseSurface;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Semantics(
            button: true,
            expanded: expanded,
            child: Material(
              color: theme.colorScheme.inverseSurface,
              borderRadius: BorderRadius.circular(8),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () {
                  if (expanded && widget.selected != null) {
                    controller.selectLine(widget.selected!);
                  }
                  setState(() => expanded = !expanded);
                },
                child: Container(
                  constraints: const BoxConstraints(minHeight: 30),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  child: Row(
                    spacing: 6,
                    children: [
                      Icon(Icons.receipt_long_outlined, color: ink, size: 15),
                      Expanded(
                        child: Text(
                          label,
                          style: theme.textTheme.labelMedium?.copyWith(
                            color: ink,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      Icon(
                        expanded ? Icons.expand_less : Icons.expand_more,
                        color: ink,
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        if (expanded)
          for (final line in widget.lines) _item(controller, line, editable),
      ],
    );
  });

  Widget _item(SaleController controller, CartLine line, bool editable) {
    final active = identical(widget.selected, line);
    final configured = controller.service.config['table_status_colors'];
    final amounts = controller.service.previewTotalOf(line);
    final card = CartItemRow(
      line: line,
      statusColor: line.voided
          ? Theme.of(context).colorScheme.error
          : line.submitted
          ? tableStatusColor(
              'occupied',
              configured is Json ? configured : const {},
            )
          : AppColors.success,
      amountAfterDiscount: amounts.gross - amounts.discount,
      discountAmount: amounts.discount,
      currency: controller.service.currency,
      selected: active,
      onSelect: () => controller.selectLine(line),
      onEditQuantity: editable && line.canEditQuantity
          ? () => controller.editQuantity(context, line)
          : null,
      onQuantity: editable && line.canEditQuantity
          ? (qty) => controller.replaceLine(line, line.withQuantity(qty))
          : null,
      actions: active ? CartItemActions(line: line) : null,
    );
    return active
        ? _RevealSelectedRow(key: ObjectKey(line), child: card)
        : card;
  }
}

class _RevealSelectedRow extends StatefulWidget {
  const _RevealSelectedRow({super.key, required this.child});

  final Widget child;

  @override
  State<_RevealSelectedRow> createState() => _RevealSelectedRowState();
}

class _RevealSelectedRowState extends State<_RevealSelectedRow> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final target = context.findRenderObject()!;
      final position = Scrollable.of(context).position;
      final top = RenderAbstractViewport.of(target)
          .getOffsetToReveal(target, 0)
          .offset;
      position.ensureVisible(
        target,
        alignmentPolicy: top <= position.pixels
            ? ScrollPositionAlignmentPolicy.keepVisibleAtStart
            : ScrollPositionAlignmentPolicy.keepVisibleAtEnd,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
