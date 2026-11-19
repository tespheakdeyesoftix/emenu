import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import '../auths/login_binding.dart';
import '../auths/login_screen.dart';
import '../core/api_endpoint.dart';
import '../core/pos_api.dart';
import '../core/register_shift_reports.dart';
import '../features/customers/customer_binding.dart';
import '../features/customers/customer_controller.dart';
import '../features/customers/customer_screen.dart';
import '../features/register/register_controller.dart';
import '../features/sales/sale_binding.dart';
import '../features/sales/sale_controller.dart';
import '../features/sales/sale_screen.dart';
import '../features/sales/sale/cart_action.dart';
import '../features/sales/sale/sales_history_view.dart';
import '../features/sales/sale/sale_service.dart';
import '../features/sales/table/widgets/table_status_label.dart';
import '../features/sales/sale/widgets/confirm_exit_sale_dialog_widget.dart';
import '../features/shifts/widgets/open_shift_dialog_widget.dart';
import '../global.dart';
import '../helpers/helper.dart';
import '../shared/app_theme.dart';
import '../shared/brand_mark.dart';
import '../shared/connection_status_widget.dart';
import '../shared/register_toast.dart';
import '../shared/register_app_bar.dart';
import 'operator_profile_view.dart';
import 'shared_widgets.dart';
import 'shift_view.dart';
import 'staff_username_view.dart';
import 'store_view.dart';
import 'translations.dart';

class PosApp extends GetView<RegisterController> {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context) => GetMaterialApp(
    initialBinding: BindingsBuilder(() {
      LoginBinding(controller).dependencies();
      SaleBinding(controller).dependencies();
      CustomerBinding(controller).dependencies();
    }),
    title: 'eMenu POS',
    debugShowCheckedModeBanner: false,
    locale: const Locale('km'),
    fallbackLocale: const Locale('en'),
    supportedLocales: const [Locale('km'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    translations: PosTranslations(),
    theme: AppTheme.light,
    home: Obx(
      () => switch (controller.stage.value) {
        RegisterStage.loading => Scaffold(
          body: Center(
            child: controller.message.value == null
                ? const SizedBox.shrink()
                : SizedBox(
                    width: 360,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 12,
                      children: [
                        RegisterNotice(controller.message.value),
                        RegisterButton(
                          'refresh',
                          onPressed: controller.initializeRegister,
                        ),
                      ],
                    ),
                  ),
          ),
        ),
        RegisterStage.ready => RegisterShell(controller),
        _ => const LoginScreen(),
      },
    ),
  );
}

class RegisterShell extends StatefulWidget {
  const RegisterShell(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<RegisterShell> createState() => _RegisterShellState();
}

class _RegisterShellState extends State<RegisterShell> {
  RegisterController get controller => widget.controller;
  bool _choosingExit = false;
  bool _drawerOpen = false;

  Future<void> _openOperatingSetup() async {
    if (controller.needsWorkingDay) {
      if (!shiftManager(controller.operator.value?.role ?? '')) {
        controller.message.value = 'shift_wait_for_manager';
        return;
      }
      if (!await app.onConfirm('shift_confirm_open_day'.tr) ||
          !mounted ||
          !controller.canOpenOperatingSession) {
        return;
      }
      if (controller.needsWorkingDay &&
          !await controller.operation(ApiEndpoint.workingDays, {})) {
        return;
      }
    }
    if (mounted) await OpenShiftDialogWidget.open(context, controller);
  }

  Future<void> _leaveSale(bool selling, VoidCallback navigate) async {
    if (_choosingExit) return;
    final service = controller.sales;
    if (!selling || !service.hasNewOrderItems) {
      navigate();
      return;
    }
    if (!service.cartEditable) return;
    final generation = service.billGeneration;
    _choosingExit = true;
    try {
      final choice = await showDialog<SaleExitChoice>(
        context: context,
        builder: (_) =>
            ConfirmExitSaleDialogWidget(canSubmit: service.canSubmit),
      );
      if (!mounted ||
          choice == null ||
          generation != service.billGeneration ||
          !service.cartEditable)
        return;
      final saved = await switch (choice) {
        SaleExitChoice.hold => service.holdCart(),
        SaleExitChoice.submit => service.submitOrder(),
        SaleExitChoice.continueWithoutSaving => service.discardCart(),
      };
      if (mounted && saved) navigate();
    } finally {
      _choosingExit = false;
    }
  }

  @override
  void initState() {
    super.initState();
    SaleBinding(controller).dependencies();
    CustomerBinding(controller).dependencies();
    if (controller.offerPinSetup) {
      controller.offerPinSetup = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) showPinOffer(context, controller);
      });
    }
  }

  @override
  void dispose() {
    Get.delete<SaleController>();
    Get.delete<CustomerController>();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, layout) => Obx(() {
      final wide = layout.maxWidth >= 800;
      final mode = controller.tableMode;
      final requiredTable = mode == 'required';
      final selected = switch (controller.tab.value) {
        RegisterController.tablesTab when mode == 'disabled' =>
          RegisterController.sellTab,
        RegisterController.sellTab
            when requiredTable && controller.tableId.value == null =>
          RegisterController.tablesTab,
        final tab => tab,
      };
      final tablePlan = selected == RegisterController.tablesTab;
      final tableSale = requiredTable && selected == RegisterController.sellTab;
      final optionalPlan = mode == 'optional' && tablePlan;
      final showCustomers = selected == RegisterController.customersTab;
      final navSelection = tablePlan ? RegisterController.sellTab : selected;
      final online = controller.online.value;
      final status = controller.paired.value
          ? (online ? 'store_connected' : 'store_disconnected')
          : (online ? 'connected' : 'offline');
      final owner = controller.operator.value?.role == 'owner';
      final canManageStaff = controller.canManageStaffUsernames;
      final waiting = controller.pending
          .where((row) => row.$2.status != 'synced')
          .length;
      final actor = controller.operator.value;
      final profileName =
          jsonObject(controller.context['profile'])['name'] as String? ??
          'eMenu POS';
      final selling = selected == RegisterController.sellTab;
      void selectDestination(int id) {
        final target = id == RegisterController.sellTab
            ? controller.landingTab
            : id;
        if (target != selected)
          _leaveSale(selling, () => controller.selectTab(target));
      }

      final destinations = [
        (RegisterController.sellTab, Icons.point_of_sale_outlined, 'sell'),
        (RegisterController.historyTab, Icons.receipt_long_outlined, 'history'),
        (RegisterController.shiftTab, Icons.schedule, 'shift'),
      ];
      final table = tableSale
          ? controller.tables
                .where((row) => row['id'] == controller.tableId.value)
                .firstOrNull
          : null;
      final title = switch (selected) {
        RegisterController.profileTab => 'user_profile'.tr,
        RegisterController.customersTab => 'customers'.tr,
        RegisterController.tablesTab => 'table_plan'.tr,
        RegisterController.sellTab =>
          table == null ? 'sell'.tr : '${'sell'.tr} · ${tableLabel(table)}',
        _ => destinations.firstWhere((row) => row.$1 == selected).$3.tr,
      };
      final colors = Theme.of(context).colorScheme;
      final busy = controller.busy.value;
      final notice = controller.commandPending.value
          ? 'STORE_COMMAND_PENDING'
          : controller.message.value;
      final showOperatingSetup =
          controller.needsOperatingSetup && (selling || tablePlan);

      Widget pane(Widget body, {Widget? search, Widget? trailing}) => Column(
        children: [
          Padding(
            key: const ValueKey('register-toolbar'),
            padding: EdgeInsets.fromLTRB(
              wide ? 16 : 8,
              wide ? 12 : 10,
              wide ? 16 : 8,
              wide ? 12 : 10,
            ),
            child: RegisterAppBar(
              search: search,
              leading: tableSale || optionalPlan || (!wide && showCustomers)
                  ? IconButton(
                      tooltip:
                          (tableSale ? 'back_to_table_plan' : 'back_to_sell')
                              .tr,
                      icon: const BackButtonIcon(),
                      onPressed: () => selectDestination(
                        tableSale
                            ? RegisterController.tablesTab
                            : RegisterController.sellTab,
                      ),
                    )
                  : !wide
                  ? Builder(
                      builder: (context) => IconButton(
                        tooltip: MaterialLocalizations.of(context)
                            .openAppDrawerTooltip,
                        icon: const Icon(Icons.menu),
                        onPressed: () => Scaffold.of(context).openDrawer(),
                      ),
                    )
                  : mode == 'optional' && selling
                  ? TextButton.icon(
                      icon: const Icon(Icons.grid_view_rounded),
                      label: Text('table_plan'.tr),
                      onPressed: () =>
                          selectDestination(RegisterController.tablesTab),
                    )
                  : null,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelMedium
                        ?.copyWith(color: colors.onSurfaceVariant),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      if (selling) _SaleStatusBadge(controller.sales),
                    ],
                  ),
                ],
              ),
              actions: [
                if (mode == 'optional' && selling && !wide)
                  IconButton(
                    tooltip: 'table_plan'.tr,
                    icon: const Icon(Icons.grid_view_rounded),
                    onPressed: () =>
                        selectDestination(RegisterController.tablesTab),
                  ),
                ConnectionStatusWidget(connected: online, label: status.tr),
                if (wide && owner)
                  IconButton(
                    onPressed: () => _storeDevices(context),
                    tooltip: 'store_devices'.tr,
                    icon: const Icon(Icons.lan_outlined),
                  ),
                if (wide && canManageStaff)
                  IconButton(
                    onPressed: busy ? null : () => _staffUsernames(context),
                    tooltip: 'staff_usernames'.tr,
                    icon: const Icon(Icons.badge_outlined),
                  ),
                ?trailing,
              ],
            ),
          ),
          Divider(
            height: 1,
            color: colors.outlineVariant.withValues(alpha: .65),
          ),
          Expanded(
            child: Stack(
              fit: StackFit.expand,
              children: [
                body,
                if (showOperatingSetup)
                  Positioned(
                    top: 8,
                    left: 12,
                    right: 12,
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 440),
                        child: FilledButton.tonal(
                          style: FilledButton.styleFrom(
                            shape: const StadiumBorder(),
                            elevation: 4,
                            backgroundColor: AppColors.warning,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 8,
                            ),
                          ),
                          onPressed: controller.canOpenOperatingSession
                              ? _openOperatingSetup
                              : null,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            spacing: 8,
                            children: [
                              const Icon(Icons.schedule, size: 18),
                              Flexible(
                                child: Text(
                                  (controller.needsWorkingDay
                                          ? 'open_day'
                                          : 'open_shift')
                                      .tr,
                                ),
                              ),
                              const Icon(Icons.chevron_right, size: 18),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      );

      final screen = switch (selected) {
        RegisterController.historyTab => pane(const SalesHistoryView()),
        RegisterController.shiftTab => pane(ShiftView(controller)),
        RegisterController.profileTab => pane(OperatorProfileView(controller)),
        RegisterController.customersTab => pane(const CustomerScreen()),
        _ => SaleScreen(layout: pane),
      };
      final guardBack =
          selling && (tableSale || controller.sales.hasNewOrderItems);
      final scaffold = Scaffold(
        onDrawerChanged: (open) => setState(() => _drawerOpen = open),
        drawer: wide
            ? null
            : Drawer(
                child: SafeArea(
                  child: ListView(
                    padding: const EdgeInsets.all(12),
                    children: [
                      ListTile(
                        title: Text(profileName),
                        subtitle: Text(actor?.displayName ?? ''),
                      ),
                      ListTile(
                        leading: const Icon(Icons.people_outline),
                        title: Text('customers'.tr),
                        onTap: () {
                          Navigator.pop(context);
                          selectDestination(RegisterController.customersTab);
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.person_outline),
                        title: Text('user_profile'.tr),
                        onTap: () {
                          Navigator.pop(context);
                          selectDestination(RegisterController.profileTab);
                        },
                      ),
                      const Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: LanguageButton(),
                      ),
                      if (owner)
                        ListTile(
                          leading: const Icon(Icons.lan_outlined),
                          title: Text('store_devices'.tr),
                          onTap: () {
                            Navigator.pop(context);
                            _storeDevices(context);
                          },
                        ),
                      if (canManageStaff)
                        ListTile(
                          leading: const Icon(Icons.badge_outlined),
                          title: Text('staff_usernames'.tr),
                          onTap: () {
                            Navigator.pop(context);
                            _staffUsernames(context);
                          },
                        ),
                      ListTile(
                        leading: const Icon(Icons.lock_outline),
                        title: Text('lock'.tr),
                        onTap: () {
                          Navigator.pop(context);
                          _leaveSale(selling, controller.lock);
                        },
                      ),
                    ],
                  ),
                ),
              ),
        bottomNavigationBar:
            wide || selected == RegisterController.profileTab || showCustomers
            ? null
            : NavigationBar(
                selectedIndex: destinations.indexWhere(
                  (row) => row.$1 == navSelection,
                ),
                onDestinationSelected: (index) =>
                    selectDestination(destinations[index].$1),
                destinations: [
                  for (final (id, icon, label) in destinations)
                    NavigationDestination(
                      icon: _navIcon(id, icon, waiting),
                      label: label.tr,
                    ),
                ],
              ),
        body: SafeArea(
          child: RegisterToastHost(
            message: notice,
            onDismissed: (message) {
              if (CartProductEdit.isWarning(message) &&
                  controller.message.value == message) {
                controller.message.value = null;
              }
            },
            child: Row(
              children: [
                if (wide)
                  Container(
                    key: const ValueKey('register-navigation-rail'),
                    width: 84,
                    decoration: BoxDecoration(
                      color: colors.surface,
                      border: BorderDirectional(
                        end: BorderSide(color: colors.outlineVariant),
                      ),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 16,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Padding(
                          padding: EdgeInsets.only(top: 4, bottom: 32),
                          child: Tooltip(
                            message: 'eMenu POS',
                            child: Center(child: BrandMark()),
                          ),
                        ),
                        Expanded(
                          child: ListView(
                            children: [
                              for (final (id, icon, label) in destinations)
                                _RailItem(
                                  icon: _navIcon(id, icon, waiting),
                                  label: label.tr,
                                  selected: navSelection == id,
                                  onTap: () => selectDestination(id),
                                ),
                              _RailItem(
                                icon: const Icon(Icons.people_outline),
                                label: 'customers'.tr,
                                selected: showCustomers,
                                onTap: () => selectDestination(
                                  RegisterController.customersTab,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.only(bottom: 10),
                          child: SizedBox(
                            height: 56,
                            child: LanguageButton(iconOnly: true),
                          ),
                        ),
                        _RailItem(
                          icon: const Icon(Icons.lock_outline),
                          label: 'lock'.tr,
                          selected: false,
                          onTap: () => _leaveSale(selling, controller.lock),
                        ),
                        _RailItem(
                          icon: const Icon(Icons.person_outline),
                          label: 'user_profile'.tr,
                          selected: selected == RegisterController.profileTab,
                          onTap: () =>
                              selectDestination(RegisterController.profileTab),
                        ),
                      ],
                    ),
                  ),
                Expanded(child: screen),
              ],
            ),
          ),
        ),
      );
      return PopScope(
        canPop: !guardBack || _drawerOpen,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop || !guardBack) return;
          if (tableSale) {
            selectDestination(RegisterController.tablesTab);
          } else {
            _leaveSale(
              selling,
              () => WidgetsBinding.instance.addPostFrameCallback((_) async {
                if (mounted && !await Navigator.of(context).maybePop())
                  await SystemNavigator.pop();
              }),
            );
          }
        },
        child: scaffold,
      );
    }),
  );

  void _storeDevices(BuildContext context) => showDialog<void>(
    context: context,
    builder: (context) => StoreView(controller),
  );

  void _staffUsernames(BuildContext context) => showDialog<void>(
    context: context,
    builder: (context) => StaffUsernameView(controller),
  );

  Widget _navIcon(int id, IconData icon, int waiting) =>
      id == RegisterController.historyTab && waiting > 0
      ? Badge.count(count: waiting, child: Icon(icon))
      : Icon(icon);
}

class _SaleStatusBadge extends StatelessWidget {
  const _SaleStatusBadge(this.sales);

  final SaleService sales;

  @override
  Widget build(BuildContext context) => Obx(() {
    final status = sales.activeSaleStatus;
    final (label, colorKey) = switch (status) {
      'occupied' => ('sales_submitted', 'occupied'),
      'bill_requested' => ('table_bill_requested', 'bill_requested'),
      'hold' => ('table_hold', 'hold'),
      _ => ('cart_new_line', 'vacant'),
    };
    final configured = sales.config['table_status_colors'];
    final background = tableStatusColor(
      colorKey,
      configured is Map ? jsonObject(configured) : {},
    );
    return DecoratedBox(
      decoration: ShapeDecoration(
        color: background,
        shape: const StadiumBorder(),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Text(
          label.tr,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: background.computeLuminance() > 0.179
                ? Colors.black
                : Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  });
}

class _RailItem extends StatelessWidget {
  const _RailItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final Widget icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Semantics(
        button: true,
        selected: selected,
        child: Tooltip(
          message: label,
          child: Material(
            color: selected ? colors.primary : Colors.transparent,
            borderRadius: BorderRadius.circular(18),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(18),
              hoverColor: colors.primary.withValues(alpha: .06),
              child: Container(
                constraints: const BoxConstraints(minHeight: 56),
                alignment: Alignment.center,
                child: IconTheme.merge(
                  data: IconThemeData(
                    color: selected
                        ? colors.onPrimary
                        : colors.onSurfaceVariant,
                  ),
                  child: icon,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
