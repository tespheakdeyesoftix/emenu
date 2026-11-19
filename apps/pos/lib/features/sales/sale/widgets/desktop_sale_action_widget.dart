import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../../sale_controller.dart';

class DesktopSaleActionWidget extends GetView<SaleController> {
  const DesktopSaleActionWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 520),
        child: LayoutBuilder(
          builder: (context, box) {
            final showLabels =
                box.maxWidth >= 420 &&
                MediaQuery.textScalerOf(context).scale(11) <= 14;
            return Semantics(
              container: true,
              label: 'cart_order_actions'.tr,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: colors.outlineVariant),
                  boxShadow: [
                    BoxShadow(
                      color: colors.primary.withValues(alpha: .09),
                      blurRadius: 20,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Padding(
                  padding: const EdgeInsets.all(6),
                  child: Row(
                    spacing: 4,
                    children: [
                      Expanded(
                        child: _DockActionButton(
                          showLabel: showLabels,
                          label: 'sale_print_bill'.tr,
                          icon: Icons.print_outlined,
                        ),
                      ),
                      Expanded(
                        child: _DockActionButton(
                          showLabel: showLabels,
                          label: 'cart_discount'.tr,
                          icon: Icons.percent_rounded,
                        ),
                      ),
                      const _DockDivider(),
                      Expanded(
                        flex: showLabels ? 3 : 2,
                        child: Row(
                          spacing: 4,
                          children: [
                            Expanded(
                              child: Obx(
                                () => _DockActionButton(
                                  showLabel: showLabels,
                                  label: 'sale_submit_new'.tr,
                                  icon: Icons.add_task_rounded,
                                  background: colors.primary,
                                  foreground: colors.onPrimary,
                                  onPressed: controller.service.canSubmit
                                      ? () => controller.submitOrder(context)
                                      : null,
                                ),
                              ),
                            ),
                            Expanded(
                              child: _DockActionButton(
                                showLabel: showLabels,
                                label: 'sale_quick_pay'.tr,
                                icon: Icons.bolt_rounded,
                                background: colors.primaryContainer,
                                foreground: colors.onPrimaryContainer,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const _DockDivider(),
                      Expanded(child: _DockMoreMenu(showLabel: showLabels)),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

// Deliberately leaves orders, payments, printing and register state untouched.
void _previewAction() {}

class _DockActionButton extends StatelessWidget {
  const _DockActionButton({
    required this.label,
    required this.icon,
    this.background,
    this.foreground,
    this.onPressed = _previewAction,
    this.showLabel = true,
  });

  final String label;
  final IconData icon;
  final Color? background;
  final Color? foreground;
  final VoidCallback? onPressed;
  final bool showLabel;

  @override
  Widget build(BuildContext context) => Tooltip(
    message: label,
    child: TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: foreground ?? Theme.of(context).colorScheme.onSurface,
        backgroundColor: background,
        minimumSize: Size(44, showLabel ? 52 : 44),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: Theme.of(context).textTheme.labelMedium
            ?.copyWith(fontSize: 11, fontWeight: FontWeight.w600),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          if (showLabel) ...[
            const SizedBox(height: 3),
            Text(
              label,
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    ),
  );
}

class _DockDivider extends StatelessWidget {
  const _DockDivider();

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 24,
    child: VerticalDivider(
      width: 1,
      thickness: 1,
      color: Theme.of(context).colorScheme.outlineVariant,
    ),
  );
}

class _DockMoreMenu extends StatelessWidget {
  const _DockMoreMenu({required this.showLabel});

  final bool showLabel;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, box) => MenuAnchor(
        // Align the popup's right edge with More. At the bottom of the screen,
        // Material positions it above the dock and keeps it inside the viewport.
        alignmentOffset: Offset(box.maxWidth - 304, 10),
        crossAxisUnconstrained: false,
        consumeOutsideTap: true,
        style: MenuStyle(
          alignment: AlignmentDirectional.bottomStart,
          backgroundColor: WidgetStatePropertyAll(colors.surface),
          surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
          elevation: const WidgetStatePropertyAll(6),
          shadowColor: WidgetStatePropertyAll(
            colors.shadow.withValues(alpha: .10),
          ),
          padding: const WidgetStatePropertyAll(EdgeInsets.all(8)),
          minimumSize: const WidgetStatePropertyAll(Size(304, 0)),
          maximumSize: const WidgetStatePropertyAll(Size(304, double.infinity)),
          side: WidgetStatePropertyAll(
            BorderSide(color: colors.outlineVariant),
          ),
          shape: WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          ),
        ),
        builder: (context, menu, child) => _DockActionButton(
          showLabel: showLabel,
          label: 'cart_more'.tr,
          icon: Icons.more_horiz_rounded,
          onPressed: () => menu.isOpen ? menu.close() : menu.open(),
        ),
        menuChildren: const [
          _MoreMenuItem(
            label: 'sale_view_bill',
            icon: Icons.receipt_long_outlined,
          ),
          _MoreMenuItem(label: 'cart_note', icon: Icons.edit_note_rounded),
          _MoreMenuItem(
            label: 'sale_change_menu',
            icon: Icons.restaurant_menu_rounded,
          ),
          _MoreMenuItem(
            label: 'sale_change_merge_table',
            icon: Icons.table_restaurant_outlined,
          ),
          _MoreMenuItem(
            label: 'sale_change_price_list_rule',
            icon: Icons.price_change_outlined,
          ),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Divider(height: 1),
          ),
          _MoreMenuItem(
            label: 'sale_void_bill',
            icon: Icons.block_rounded,
            destructive: true,
          ),
        ],
      ),
    );
  }
}

class _MoreMenuItem extends StatelessWidget {
  const _MoreMenuItem({
    required this.label,
    required this.icon,
    this.destructive = false,
  });

  final String label;
  final IconData icon;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final color = destructive ? colors.error : colors.onSurface;
    return MenuItemButton(
      onPressed: _previewAction,
      leadingIcon: Icon(
        icon,
        size: 20,
        color: destructive ? color : colors.onSurfaceVariant,
      ),
      style: MenuItemButton.styleFrom(
        foregroundColor: color,
        minimumSize: const Size(48, 48),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: Text(label.tr),
    );
  }
}
