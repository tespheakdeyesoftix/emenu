import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import '../auths/login_binding.dart';
import '../auths/login_screen.dart';
import '../core/pos_api.dart';
import '../features/customers/customer_binding.dart';
import '../features/customers/customer_controller.dart';
import '../features/customers/customer_screen.dart';
import '../features/register/register_controller.dart';
import '../features/sales/sale_binding.dart';
import '../features/sales/sale_controller.dart';
import '../features/sales/sale_screen.dart';
import '../features/sales/sale/sales_history_view.dart';
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
      void selectDestination(int id) => controller.selectTab(
        id == RegisterController.sellTab ? controller.landingTab : id,
      );

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
      final selling = selected == RegisterController.sellTab;
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
                          controller.selectTab(RegisterController.tablesTab),
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
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ],
              ),
              actions: [
                if (mode == 'optional' && selling && !wide)
                  IconButton(
                    tooltip: 'table_plan'.tr,
                    icon: const Icon(Icons.grid_view_rounded),
                    onPressed: () =>
                        controller.selectTab(RegisterController.tablesTab),
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
          if (showOperatingSetup)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: ListTile(
                leading: const Icon(Icons.schedule),
                tileColor: colors.secondaryContainer,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                title: Text('open_operating_context'.tr),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => controller.tab.value = RegisterController.shiftTab,
              ),
            ),
          Expanded(child: body),
        ],
      );

      final screen = switch (selected) {
        RegisterController.historyTab => pane(const SalesHistoryView()),
        RegisterController.shiftTab => pane(ShiftView(controller)),
        RegisterController.profileTab => pane(OperatorProfileView(controller)),
        RegisterController.customersTab => pane(const CustomerScreen()),
        _ => SaleScreen(layout: pane),
      };
      return Scaffold(
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
                          controller.tab.value = RegisterController.profileTab;
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
                          controller.lock();
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
                          onTap: controller.lock,
                        ),
                        _RailItem(
                          icon: const Icon(Icons.person_outline),
                          label: 'user_profile'.tr,
                          selected: selected == RegisterController.profileTab,
                          onTap: () => controller.tab.value =
                              RegisterController.profileTab,
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
