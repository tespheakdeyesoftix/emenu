import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:get/get.dart';

import '../core/pos_api.dart';
import '../core/pricing.dart';
import '../features/register/register_controller.dart';
import 'access_view.dart';
import 'receipt_dialog.dart';
import 'sell_view.dart';
import 'shared_widgets.dart';
import 'shift_view.dart';
import 'staff_username_view.dart';
import 'store_view.dart';
import 'translations.dart';

class PosApp extends GetView<RegisterController> {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context) => GetMaterialApp(
    title: 'eMenu POS',
    debugShowCheckedModeBanner: false,
    locale: const Locale('km'),
    fallbackLocale: const Locale('en'),
    supportedLocales: const [Locale('km'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    translations: PosTranslations(),
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff315947)),
      fontFamily: 'Noto Sans Khmer',
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(minimumSize: const Size(52, 50)),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
      ),
    ),
    home: Obx(
      () => switch (controller.stage.value) {
        RegisterStage.loading => Scaffold(
          body: Center(
            child: controller.message.value == null
                ? const CircularProgressIndicator()
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
        _ => AccessView(controller),
      },
    ),
  );
}

class RegisterShell extends StatelessWidget {
  const RegisterShell(this.controller, {super.key});

  final RegisterController controller;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, layout) => Obx(() {
      final wide = layout.maxWidth >= 800;
      final selected = controller.tab.value;
      final status = controller.paired.value
          ? (controller.online.value ? 'store_connected' : 'store_disconnected')
          : (controller.online.value ? 'connected' : 'offline');
      final owner = controller.operator.value?.role == 'owner';
      final canManageStaff = controller.canManageStaffUsernames;
      final waiting = controller.pending
          .where((row) => row.$2.status != 'synced')
          .length;
      final destinations = [
        (Icons.point_of_sale_outlined, 'sell'.tr),
        (Icons.receipt_long_outlined, 'history'.tr),
        (Icons.schedule, 'shift'.tr),
      ];
      final screen = switch (selected) {
        1 => _SalesHistory(controller),
        2 => ShiftView(controller),
        _ => SellView(controller),
      };
      return Scaffold(
        appBar: AppBar(
          title: Text(
            jsonObject(controller.context['profile'])['name'] as String? ??
                'eMenu POS',
            overflow: TextOverflow.ellipsis,
          ),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Center(child: Text(status.tr)),
            ),
            if (wide) const LanguageButton(),
            if (wide && owner)
              IconButton(
                onPressed: () => _storeDevices(context),
                tooltip: 'store_devices'.tr,
                icon: const Icon(Icons.lan_outlined),
              ),
            if (wide && canManageStaff)
              IconButton(
                onPressed: controller.busy.value
                    ? null
                    : () => _staffUsernames(context),
                tooltip: 'staff_usernames'.tr,
                icon: const Icon(Icons.badge_outlined),
              ),
            if (wide)
              IconButton(
                onPressed: controller.lock,
                tooltip: 'lock'.tr,
                icon: const Icon(Icons.lock_outline),
              ),
          ],
        ),
        drawer: wide
            ? null
            : Drawer(
                child: SafeArea(
                  child: ListView(
                    children: [
                      const ListTile(title: Text('eMenu POS')),
                      const Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: LanguageButton(),
                      ),
                      if (owner)
                        ListTile(
                          leading: const Icon(Icons.lan_outlined),
                          title: Text('store_devices'.tr),
                          onTap: () {
                            Navigator.of(context).pop();
                            _storeDevices(context);
                          },
                        ),
                      if (canManageStaff)
                        ListTile(
                          leading: const Icon(Icons.badge_outlined),
                          title: Text('staff_usernames'.tr),
                          onTap: () {
                            Navigator.of(context).pop();
                            _staffUsernames(context);
                          },
                        ),
                      ListTile(
                        leading: const Icon(Icons.lock_outline),
                        title: Text('lock'.tr),
                        onTap: () {
                          Navigator.of(context).pop();
                          controller.lock();
                        },
                      ),
                    ],
                  ),
                ),
              ),
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: selected,
                onDestinationSelected: (index) => controller.tab.value = index,
                destinations: destinations.indexed
                    .map(
                      (item) => NavigationDestination(
                        icon: _navIcon(item.$1, item.$2.$1, waiting),
                        label: item.$2.$2,
                      ),
                    )
                    .toList(),
              ),
        body: Row(
          children: [
            if (wide) ...[
              NavigationRail(
                selectedIndex: selected,
                labelType: NavigationRailLabelType.all,
                onDestinationSelected: (index) => controller.tab.value = index,
                destinations: destinations.indexed
                    .map(
                      (item) => NavigationRailDestination(
                        icon: _navIcon(item.$1, item.$2.$1, waiting),
                        label: Text(item.$2.$2),
                      ),
                    )
                    .toList(),
              ),
              const VerticalDivider(width: 1),
            ],
            Expanded(
              child: Column(
                children: [
                  RegisterNotice(
                    controller.commandPending.value
                        ? 'STORE_COMMAND_PENDING'
                        : controller.message.value,
                  ),
                  if (controller.busy.value) const LinearProgressIndicator(),
                  Expanded(child: screen),
                ],
              ),
            ),
          ],
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

  Widget _navIcon(int index, IconData icon, int waiting) =>
      index == 1 && waiting > 0
      ? Badge.count(count: waiting, child: Icon(icon))
      : Icon(icon);
}

class _SalesHistory extends StatelessWidget {
  const _SalesHistory(this.controller);

  final RegisterController controller;

  @override
  Widget build(BuildContext context) => Obx(() {
    final sales = controller.pending;
    final reversals = {
      for (final (sale, job) in sales)
        if (sale.reversesSaleId != null) sale.reversesSaleId: job.status,
    };
    final held = controller.heldBills;
    if (sales.isEmpty && held.isEmpty) {
      return Center(child: Text('no_sales'.tr));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(12),
      itemCount: held.length + sales.length,
      separatorBuilder: (_, _) => const Divider(height: 1),
      itemBuilder: (context, index) {
        if (index < held.length) {
          final bill = held[index];
          final snapshot = jsonObject(jsonDecode(bill.payload));
          return ListTile(
            leading: const Icon(Icons.pause_circle_outline),
            title: Text(snapshot['table_label'] as String? ?? 'counter'.tr),
            subtitle: Text('held'.tr),
            onTap: () => controller.resumeBill(bill),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  displayAmount(
                    snapshot['total_minor'] as int,
                    snapshot['currency'] as String,
                  ),
                ),
                IconButton(
                  tooltip: 'discard'.tr,
                  icon: const Icon(Icons.close),
                  onPressed: () async {
                    if (await confirmDiscard(context, 'discard')) {
                      await controller.discardBill(bill);
                    }
                  },
                ),
              ],
            ),
          );
        }
        final (sale, job) = sales[index - held.length];
        final reversal = reversals[sale.id];
        final label = reversal == null
            ? job.status
            : reversal == 'synced' || controller.storeOperations
            ? 'reversed'
            : reversal == 'attention'
            ? 'attention'
            : 'reversal_pending';
        return ListTile(
          leading: Icon(switch (job.status) {
            'synced' => Icons.cloud_done_outlined,
            'attention' => Icons.error_outline,
            _ => Icons.cloud_upload_outlined,
          }),
          title: Text(displayAmount(sale.total, sale.currency)),
          subtitle: Text(
            job.lastError?.tr ??
                (sale.reversesSaleId != null ? 'reversal'.tr : null) ??
                (sale.id.length <= 8 ? sale.id : sale.id.substring(0, 8)),
          ),
          trailing: Text(label.tr),
          onTap: () {
            final operatorId = controller.operator.value!.id;
            showDialog<void>(
              context: context,
              barrierDismissible: false,
              builder: (receiptContext) => ReceiptDialog(
                sale: sale,
                syncStatus: job.status,
                recordPrint: (copies) => controller.database.recordReceiptPrint(
                  sale.id,
                  operatorId,
                  copies,
                ),
                reverse: controller.canReverseSale(sale)
                    ? () async {
                        final expected = controller.operatingContext;
                        final reason = await showDialog<String>(
                          context: receiptContext,
                          builder: (_) => ReversalDialog(
                            sale: sale,
                            offlineOperations: controller.storeOperations,
                          ),
                        );
                        if (reason == null || !receiptContext.mounted) return;
                        Navigator.pop(receiptContext);
                        await controller.reverseSale(sale, reason, expected);
                      }
                    : null,
              ),
            );
          },
        );
      },
    );
  });
}
