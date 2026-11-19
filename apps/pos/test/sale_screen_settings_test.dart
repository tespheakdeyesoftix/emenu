import 'dart:io';

import 'package:drift/native.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:emenu_pos/features/register/register_controller.dart';
import 'package:emenu_pos/features/sales/sale/sale_screen_settings.dart';
import 'package:emenu_pos/features/sales/sale/sale_service.dart';
import 'package:emenu_pos/features/sales/sale/sell_view.dart';
import 'package:emenu_pos/features/sales/sale/widgets/catalog_folder_card.dart';
import 'package:emenu_pos/features/sales/sale/widgets/catalog_product_grid.dart';
import 'package:emenu_pos/features/sales/sale/widgets/catalog_top_menu.dart';
import 'package:emenu_pos/features/sales/sale/widgets/catalog_tree.dart';
import 'package:emenu_pos/features/sales/sale/widgets/sale_screen_setting_dialog_widget.dart';
import 'package:emenu_pos/features/sales/sale_binding.dart';
import 'package:emenu_pos/features/sales/sale_controller.dart';
import 'package:emenu_pos/features/sales/sale_screen.dart';
import 'package:emenu_pos/shared/app_theme.dart';
import 'package:emenu_pos/shared/loading_dialog_widget.dart';
import 'package:emenu_pos/shared/network_cached_image_widget.dart';
import 'package:emenu_pos/ui/translations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:get/get.dart';

Json catalogSnapshot({String mode = 'menu'}) => {
  'context': {
    'profile': {
      'name': 'Counter',
      'config': {
        'table_mode': 'disabled',
        'tax_mode': 'disabled',
        'catalog_mode': mode,
        'default_menu_id': mode == 'menu' ? 'root' : null,
      },
    },
    'business': {'currency': 'USD', 'secondary_exchange_rate': '4000'},
  },
  'catalog': {
    'mode': mode,
    'nodes': [
      {'id': 'root', 'parent_id': null, 'name': 'Food'},
      {'id': 'drinks', 'parent_id': 'root', 'name': 'Drinks'},
      {'id': 'hot', 'parent_id': 'drinks', 'name': 'Hot drinks'},
      {'id': 'cakes', 'parent_id': 'root', 'name': 'Cakes'},
    ],
    'products': [
      {
        'id': 'bread',
        'name': 'Bread',
        'code': 'B1',
        'price_minor': 100,
        'menu_ids': ['root'],
        'category_id': 'root',
      },
      {
        'id': 'tea',
        'name': 'Tea',
        'code': 'T1',
        'price_minor': 150,
        'menu_ids': ['drinks'],
        'category_id': 'drinks',
      },
      {
        'id': 'coffee',
        'name': 'Coffee',
        'code': 'C1',
        'price_minor': 200,
        'menu_ids': ['hot'],
        'category_id': 'hot',
      },
      {
        'id': 'cake',
        'name': 'Cake',
        'code': 'K1',
        'price_minor': 300,
        'menu_ids': ['cakes', 'root'],
        'category_id': 'cakes',
      },
    ],
  },
  'tables': [],
  'customers': [],
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late RegisterDatabase database;
  late RegisterController register;
  late SaleController controller;
  late SaleService service;

  setUp(() {
    database = RegisterDatabase(NativeDatabase.memory());
    register = RegisterController(database)..snapshot.value = catalogSnapshot();
    SaleBinding(register).dependencies();
    controller = Get.find<SaleController>();
    service = register.sales;
  });

  tearDown(() async {
    await Get.delete<SaleController>(force: true);
    Get.reset();
    await database.close();
  });

  Finder settingsField(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(TextFormField),
  );

  Future<void> mount(
    WidgetTester tester, {
    Size size = const Size(1440, 900),
    Widget? body,
    String language = 'en',
    double scale = 1,
  }) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = size;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      GetMaterialApp(
        theme: AppTheme.light,
        locale: Locale(language),
        translations: PosTranslations(),
        supportedLocales: const [Locale('en'), Locale('km')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context)
              .copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home:
            body ??
            SaleScreen(
              layout: (body, {search, trailing}) => Scaffold(
                appBar: AppBar(actions: [?trailing]),
                body: Column(
                  children: [
                    if (search != null)
                      Padding(padding: const EdgeInsets.all(12), child: search),
                    Expanded(child: body),
                  ],
                ),
              ),
            ),
      ),
    );
    await tester.pumpAndSettle();
  }

  for (final mode in ['menu', 'category']) {
    test('$mode navigation shows subtree products and child folders', () {
      register.snapshot.value = catalogSnapshot(mode: mode);
      controller.openSection(null);
      expect(controller.visibleProducts.map((product) => product['id']), [
        'bread',
        'tea',
        'coffee',
        'cake',
      ]);
      controller.openSection('root');
      expect(controller.visibleFolders.map((node) => node['id']), [
        'drinks',
        'cakes',
      ]);
      expect(controller.visibleProducts.map((product) => product['id']), [
        'bread',
        'tea',
        'coffee',
        'cake',
      ]);
      controller.openSection('hot');
      expect(controller.sectionPath.map((node) => node['id']), [
        if (mode == 'category') 'root',
        'drinks',
        'hot',
      ]);
      expect(controller.visibleProducts.single['id'], 'coffee');
      controller.goUp();
      expect(controller.section.value, 'drinks');
      expect(controller.visibleProducts.map((product) => product['id']), [
        'tea',
        'coffee',
      ]);
    });
  }

  testWidgets('catalog reveals 50 products at a time and resets in a folder', (
    tester,
  ) async {
    final snapshot = catalogSnapshot();
    final catalog = snapshot['catalog'] as Json;
    catalog['products'] = [
      for (var index = 0; index < 105; index++)
        {
          'id': 'item-$index',
          'name': 'Item $index',
          'price_minor': 100,
          'menu_ids': [index < 100 ? 'hot' : 'cakes'],
        },
    ];
    register.snapshot.value = snapshot;
    await mount(
      tester,
      size: const Size(900, 650),
      body: const Scaffold(body: CatalogProductGrid()),
    );
    final grid = find.byKey(const ValueKey('catalog-product-grid'));
    ScrollPosition position() =>
        tester.widget<CustomScrollView>(grid).controller!.position;
    int productCount() => tester
        .widget<SliverGrid>(find.byType(SliverGrid).last)
        .delegate
        .estimatedChildCount!;
    Future<void> scrollToEnd() async {
      position().jumpTo(position().maxScrollExtent);
      await tester.pumpAndSettle();
    }

    expect(
      find.byKey(const ValueKey('catalog-product-item-0')),
      findsOneWidget,
    );
    expect(productCount(), 50);
    final backToTop = find.byTooltip('Back to top');
    expect(backToTop, findsNothing);
    await scrollToEnd();
    expect(productCount(), 100);
    await scrollToEnd();
    expect(productCount(), 105);
    await tester.tap(backToTop);
    await tester.pumpAndSettle();
    expect(position().pixels, position().minScrollExtent);
    expect(productCount(), 105);
    expect(backToTop, findsNothing);
    await scrollToEnd();

    controller.openSection('drinks');
    await tester.pumpAndSettle();
    expect(position().pixels, 0);
    expect(backToTop, findsNothing);
    final childFolder = find.byKey(const ValueKey('catalog-folder-hot'));
    final firstProduct = find.byKey(const ValueKey('catalog-product-item-0'));
    expect(
      tester.getBottomLeft(childFolder).dy,
      lessThan(tester.getTopLeft(firstProduct).dy),
    );
    expect(productCount(), 50);
    await scrollToEnd();
    expect(productCount(), 100);
    await scrollToEnd();
    expect(productCount(), 100);

    controller.search.text = 'missing product';
    controller.searchChanged(controller.search.text);
    await tester.pump(const Duration(milliseconds: 700));
    await tester.pump();
    await tester.tap(find.text('Show all products'));
    await tester.pumpAndSettle();
    expect(controller.search.text, isEmpty);
    expect(controller.section.value, controller.defaultSection);
    expect(find.text('Show all products'), findsNothing);
    expect(productCount(), 50);
    await scrollToEnd();
    await scrollToEnd();
    expect(productCount(), 105);
  });

  testWidgets('product card layout changes and keeps the card tappable', (
    tester,
  ) async {
    controller.openSection('drinks');
    await mount(tester, scale: 1.4);
    final card = find.byKey(const ValueKey('catalog-product-tea'));
    final image = find.descendant(
      of: card,
      matching: find.byType(NetworkCachedImageWidget),
    );
    final name = find.descendant(of: card, matching: find.text('Tea'));
    expect(tester.getRect(image).bottom, lessThan(tester.getRect(name).top));

    await tester.tap(find.byTooltip('Image left'));
    await tester.pumpAndSettle();
    expect(tester.getRect(image).right, lessThan(tester.getRect(name).left));
    expect(controller.section.value, 'drinks');

    tester.view.physicalSize = const Size(390, 820);
    await tester.pumpAndSettle();
    expect(tester.getRect(image).right, lessThan(tester.getRect(name).left));
    expect(tester.takeException(), isNull);

    await tester.tap(card);
    await tester.pumpAndSettle();
    expect(service.cart.single.product['id'], 'tea');

    await tester.tap(find.byTooltip('Image top'));
    await tester.pumpAndSettle();
    expect(tester.getRect(image).bottom, lessThan(tester.getRect(name).top));
  });

  Json multipleMenus() {
    final snapshot = catalogSnapshot();
    final catalog = snapshot['catalog'] as Json;
    catalog['nodes'] = <Json>[
      ...jsonRows(catalog['nodes']),
      {'id': 'other', 'parent_id': null, 'name': 'Other menu'},
      {'id': 'other-child', 'parent_id': 'other', 'name': 'Other submenu'},
    ];
    (catalog['products'] as List).add({
      'id': 'other-product',
      'name': 'Other product',
      'code': 'OTHER',
      'price_minor': 500,
      'menu_ids': ['other-child'],
    });
    return snapshot;
  }

  test('cached menus, search and scanning stay within the default menu', () {
    register.snapshot.value = multipleMenus();
    expect(service.catalogNodes.map((node) => node['id']), [
      'root',
      'drinks',
      'hot',
      'cakes',
    ]);
    controller.openSection(null);
    expect(controller.section.value, 'root');
    expect(controller.canGoUp, isFalse);
    expect(controller.sectionPath, isEmpty);
    expect(
      controller.catalogNavigation.navigationRoots.map((node) => node['id']),
      ['drinks', 'cakes'],
    );
    final rows = controller.catalogNavigation.treeRows({'drinks'});
    expect(rows.map((row) => (row.node['id'], row.depth)), [
      ('drinks', 0),
      ('hot', 1),
      ('cakes', 0),
    ]);
    controller.goUp();
    controller.openSection('other');
    expect(controller.section.value, 'root');
    expect(service.filterProducts(term: 'other'), isEmpty);
    expect(service.productByCode('OTHER'), isNull);

    controller.openSection('hot');
    final changed = multipleMenus();
    ((changed['context'] as Json)['profile']
            as Json)['config']['default_menu_id'] =
        'other';
    register.snapshot.value = changed;
    expect(controller.section.value, 'other');
    expect(service.catalogNodes.map((node) => node['id']), [
      'other',
      'other-child',
    ]);
    expect(service.products.single['id'], 'other-product');
    expect(service.productByCode('C1'), isNull);
  });

  for (final id in [null, 'missing']) {
    test('an unavailable default menu never displays all menus ($id)', () {
      final changed = multipleMenus();
      ((changed['context'] as Json)['profile']
              as Json)['config']['default_menu_id'] =
          id;
      register.snapshot.value = changed;
      controller.openSection(null);
      expect(service.catalogNodes, isEmpty);
      expect(service.products, isEmpty);
      expect(controller.visibleFolders, isEmpty);
      expect(controller.visibleProducts, isEmpty);
      expect(
        service.catalogMenuIssue,
        id == null ? 'DEFAULT_MENU_REQUIRED' : 'DEFAULT_MENU_UNAVAILABLE',
      );
    });
  }

  for (final layout in SaleScreenLayout.values) {
    testWidgets('${layout.key} cannot navigate above the default menu', (
      tester,
    ) async {
      register.snapshot.value = multipleMenus();
      service.screenSettings.value = SaleScreenSettings(layout: layout);
      await mount(tester);
      expect(find.text('Other menu'), findsNothing);
      expect(find.text('Other submenu'), findsNothing);
      expect(find.text('Catalog'), findsWidgets);
      expect(find.text('Food'), findsNothing);
      controller.openSection('drinks');
      await tester.pumpAndSettle();
      expect(controller.sectionPath.map((node) => node['id']), ['drinks']);
      await tester.tap(find.byTooltip('Up one folder'));
      await tester.pumpAndSettle();
      expect(controller.section.value, 'root');
      controller.openSection('hot');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Catalog').first);
      await tester.pumpAndSettle();
      expect(controller.section.value, 'root');
      expect(controller.canGoUp, isFalse);
      expect(find.byKey(const ValueKey('catalog-folder-root')), findsNothing);
      expect(find.byKey(const ValueKey('catalog-folder-other')), findsNothing);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('global search and code scanning preserve the opened folder', (
    tester,
  ) async {
    controller.openSection('cakes');
    controller.searchChanged('coffee');
    await tester.pump(const Duration(milliseconds: 700));
    expect(controller.visibleFolders, isEmpty);
    expect(controller.visibleProducts.single['id'], 'coffee');
    controller.clearSearch();
    expect(controller.section.value, 'cakes');
    expect(controller.visibleProducts.single['id'], 'cake');
    expect(controller.searchSubmitted('C1')?['id'], 'coffee');
    expect(controller.section.value, 'cakes');
  });

  test(
    'catalog updates reset removed folders and keep orphan roots visible',
    () {
      controller.openSection('hot');
      final snapshot = catalogSnapshot();
      final catalog = snapshot['catalog'] as Json;
      catalog['nodes'] = [
        {'id': 'root', 'name': 'Food', 'parent_id': 'outside-scope'},
      ];
      register.snapshot.value = snapshot;
      expect(controller.section.value, 'root');
      expect(
        controller.catalogNavigation.childrenOf(null).single['id'],
        'root',
      );
      expect(controller.expandedSections, isNot(contains('hot')));
    },
  );

  test('products assigned to several menus render once', () {
    final snapshot = catalogSnapshot();
    final catalog = snapshot['catalog'] as Json;
    final products = catalog['products'] as List;
    products.add(products.last);
    register.snapshot.value = snapshot;
    expect(
      controller.visibleProducts.where((row) => row['id'] == 'cake'),
      hasLength(1),
    );
  });

  test(
    'preferences survive a new service and invalid saved values use defaults',
    () async {
      service.add(CartLine(jsonRows(service.catalog['products']).first));
      final original = service.cart.single;
      expect(
        await service.saveScreenSettings(
          const SaleScreenSettings(
            layout: SaleScreenLayout.menuLeft,
            orderProductListWidth: 500,
            catalogWidth: 280,
          ),
        ),
        isTrue,
      );
      final restored = SaleService(RegisterController(database));
      await restored.loadScreenSettings();
      expect(restored.screenSettings.value.layout, SaleScreenLayout.menuLeft);
      expect(restored.screenSettings.value.orderProductListWidth, 500);
      expect(restored.screenSettings.value.catalogWidth, 280);
      expect(service.cart.single, same(original));
      expect(
        await service.saveScreenSettings(
          const SaleScreenSettings(orderProductListWidth: 900),
        ),
        isFalse,
      );
      expect(service.screenSettings.value.orderProductListWidth, 500);
      expect(
        await service.saveScreenSettings(
          const SaleScreenSettings(catalogWidth: 500),
        ),
        isFalse,
      );
      expect(register.message.value, 'INVALID_CATALOG_WIDTH');
      expect(service.screenSettings.value.catalogWidth, 280);
      await database.saveUiPreferences('unknown-layout', 12);
      await restored.loadScreenSettings();
      expect(restored.screenSettings.value.layout, SaleScreenLayout.menuTop);
      expect(restored.screenSettings.value.orderProductListWidth, 350);
      expect(restored.screenSettings.value.catalogWidth, 200);
    },
  );

  test(
    'version 14 preferences gain a catalog width without losing settings',
    () async {
      final folder = await Directory.systemTemp.createTemp(
        'pos-catalog-width-',
      );
      addTearDown(() => folder.delete(recursive: true));
      final file = File('${folder.path}/register.sqlite');
      final old = RegisterDatabase(NativeDatabase(file));
      await old.saveUiPreferences('menu_left', 480);
      await old.customStatement(
        'ALTER TABLE register_ui_preferences DROP COLUMN catalog_width',
      );
      await old.customStatement('PRAGMA user_version = 14');
      await old.close();
      final upgraded = RegisterDatabase(NativeDatabase(file));
      addTearDown(upgraded.close);
      expect(await upgraded.readUiPreferences(), {
        'sell_screen_layout': 'menu_left',
        'order_product_list_width': 480,
        'catalog_width': 200,
      });
      await upgraded.saveUiPreferences('menu_left', 480, catalogWidth: 300);
      expect((await upgraded.readUiPreferences())!['catalog_width'], 300);
    },
  );

  testWidgets(
    'left menu stops at children and only first-level rows have icons',
    (tester) async {
      final snapshot = catalogSnapshot();
      snapshot['catalog']['nodes'] = <Json>[
        ...jsonRows(snapshot['catalog']['nodes']),
        {'id': 'deep', 'parent_id': 'hot', 'name': 'Deep folder'},
      ];
      register.snapshot.value = snapshot;
      service.screenSettings.value = const SaleScreenSettings(
        layout: SaleScreenLayout.menuLeft,
      );
      controller.openSection('deep');
      await mount(tester);
      final tree = find.byType(CatalogTree);
      expect(
        find.descendant(of: tree, matching: find.text('Deep folder')),
        findsNothing,
      );
      final child = tester.widget<ListTile>(
        find.descendant(
          of: tree,
          matching: find.widgetWithText(ListTile, 'Hot drinks'),
        ),
      );
      expect(child.leading, isNull);
      expect(child.trailing, isNull);
      expect(child.selected, isTrue);
      final parent = tester.widget<ListTile>(
        find.descendant(
          of: tree,
          matching: find.widgetWithText(ListTile, 'Drinks'),
        ),
      );
      expect(parent.leading, isA<Icon>());
      expect(parent.trailing, isA<IconButton>());
      await tester.tap(
        find.descendant(of: tree, matching: find.text('Hot drinks')),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('catalog-folder-deep')), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  test(
    'version 12 upgrade preserves held bills, pending sales, and cart drafts',
    () async {
      await database.close();
      final folder = await Directory.systemTemp.createTemp('pos-settings-');
      addTearDown(() => folder.delete(recursive: true));
      final file = File('${folder.path}/register.sqlite');
      final old = RegisterDatabase(NativeDatabase(file));
      await old.holdBill(
        id: 'held',
        profileId: 'profile',
        payload: {'saved': true},
      );
      await old.queueSale(
        id: 'sale',
        profileId: 'profile',
        operatorId: 'actor',
        total: 100,
        currency: 'USD',
        request: {'draft': {}},
      );
      await old
          .into(old.registerOperators)
          .insert(
            RegisterOperatorsCompanion.insert(
              id: 'actor',
              email: 'actor@example.test',
              displayName: 'Actor',
              role: 'owner',
            ),
          );
      await old.saveCartDraft(
        operatorId: 'actor',
        profileId: 'profile',
        billId: null,
        payload: '{"lines":["saved"]}',
      );
      await old.customStatement('DROP TABLE register_ui_preferences');
      await old.customStatement('DROP TABLE IF EXISTS discarded_bills');
      await old.customStatement('PRAGMA user_version = 12');
      await old.close();
      final upgraded = RegisterDatabase(NativeDatabase(file));
      expect(await upgraded.readUiPreferences(), isNull);
      expect((await upgraded.watchHeldBills().first).single.id, 'held');
      expect((await upgraded.sale('sale')).total, 100);
      expect((await upgraded.nextJob())!.saleId, 'sale');
      expect(
        (await upgraded.cartDraft('actor', 'profile'))!.payload,
        contains('saved'),
      );
      await upgraded.saveUiPreferences('browsable', 420);
      await upgraded.close();
      final reopened = database = RegisterDatabase(NativeDatabase(file));
      addTearDown(reopened.close);
      expect(
        (await reopened.readUiPreferences())!['order_product_list_width'],
        420,
      );
    },
  );

  for (final layout in SaleScreenLayout.values) {
    testWidgets(
      '${layout.key} opens folders and adds products without losing the cart',
      (tester) async {
        service.screenSettings.value = SaleScreenSettings(layout: layout);
        await mount(tester);
        expect(
          find.byType(CatalogTopMenu),
          layout == SaleScreenLayout.menuTop ? findsOneWidget : findsNothing,
        );
        expect(
          find.byType(CatalogTree),
          layout == SaleScreenLayout.menuLeft ? findsOneWidget : findsNothing,
        );
        expect(find.byType(CatalogFolderCard), findsNWidgets(2));
        final folder = tester.getRect(
          find.byKey(const ValueKey('catalog-folder-drinks')),
        );
        final product = tester.getRect(
          find.byKey(const ValueKey('catalog-product-bread')),
        );
        expect(folder.height, lessThan(100));
        expect(product.top - folder.bottom, lessThanOrEqualTo(8));
        await tester.tap(find.byKey(const ValueKey('catalog-folder-drinks')));
        await tester.pumpAndSettle();
        expect(controller.section.value, 'drinks');
        if (layout == SaleScreenLayout.menuTop) {
          expect(
            find.descendant(
              of: find.byType(CatalogTopMenu),
              matching: find.widgetWithText(ChoiceChip, 'Hot drinks'),
            ),
            findsNothing,
          );
          expect(
            find.byKey(const ValueKey('catalog-folder-hot')),
            findsOneWidget,
          );
          expect(
            tester
                .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Drinks'))
                .selected,
            isTrue,
          );
        }
        await tester.tap(find.byKey(const ValueKey('catalog-product-tea')));
        await tester.pumpAndSettle();
        expect(service.cart.single.product['id'], 'tea');
        expect(find.byType(LoadingDialogWidget), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('overflow offers Reload menu and closes loading after an error', (
    tester,
  ) async {
    await mount(tester);
    controller.openSection('drinks');
    final snapshot = register.snapshot.value;
    await tester.tap(find.byKey(const ValueKey('sale-screen-settings-menu')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reload menu'));
    await tester.pumpAndSettle();
    expect(register.message.value, 'SIGN_IN_REQUIRED');
    expect(register.busy.value, isFalse);
    expect(register.snapshot.value, same(snapshot));
    expect(controller.section.value, 'drinks');
    expect(find.byType(LoadingDialogWidget), findsNothing);
    expect(find.byType(SaleScreenSettingDialogWidget), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'overflow opens settings, validates width, and Cancel discards changes',
    (tester) async {
      await mount(tester);
      await tester.tap(find.byKey(const ValueKey('sale-screen-settings-menu')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sell screen settings').last);
      await tester.pumpAndSettle();
      expect(find.byType(SaleScreenSettingDialogWidget), findsOneWidget);
      final width = settingsField('order-product-list-width');
      await tester.enterText(width, '700');
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(find.text('Enter a width from 280 to 600.'), findsOneWidget);
      await tester.enterText(width, '480');
      await tester.enterText(settingsField('catalog-width'), '80');
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(find.text('Enter a width from 160 to 360.'), findsOneWidget);
      await tester.enterText(settingsField('catalog-width'), '260');
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();
      expect(service.screenSettings.value.orderProductListWidth, 350);
      expect(service.screenSettings.value.catalogWidth, 200);
    },
  );

  testWidgets(
    'saving settings applies width after persistence and survives controller recreation',
    (tester) async {
      await mount(tester);
      controller.openScreenSettings();
      await tester.pumpAndSettle();
      await tester.tap(find.byType(DropdownButtonFormField<SaleScreenLayout>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Menu left').last);
      await tester.pumpAndSettle();
      await tester.enterText(settingsField('order-product-list-width'), '480');
      await tester.enterText(settingsField('catalog-width'), '260');
      await tester.tap(find.widgetWithText(FilledButton, 'Save'));
      await tester.pumpAndSettle();
      expect(find.byType(SaleScreenSettingDialogWidget), findsNothing);
      expect(service.screenSettings.value.layout, SaleScreenLayout.menuLeft);
      final panel = tester.widget<SizedBox>(
        find.byKey(const ValueKey('sale-order-panel')),
      );
      expect(panel.width, 480);
      expect(
        tester
            .widget<SizedBox>(find.byKey(const ValueKey('catalog-left-tree')))
            .width,
        260,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await Get.delete<SaleController>();
      SaleBinding(register).dependencies();
      final recreated = Get.find<SaleController>();
      expect(recreated.screenSettings.layout, SaleScreenLayout.menuLeft);
      expect(recreated.screenSettings.orderProductListWidth, 480);
      expect(recreated.screenSettings.catalogWidth, 260);
    },
  );

  testWidgets('left menus and order width adapt to compact Khmer screens', (
    tester,
  ) async {
    service.screenSettings.value = const SaleScreenSettings(
      layout: SaleScreenLayout.menuLeft,
      orderProductListWidth: 600,
    );
    await mount(tester, size: const Size(390, 820), language: 'km', scale: 1.4);
    expect(find.byKey(const ValueKey('sale-order-panel')), findsNothing);
    expect(find.byKey(const ValueKey('catalog-open-tree')), findsOneWidget);
    await tester.tap(find.byKey(const ValueKey('catalog-open-tree')));
    await tester.pumpAndSettle();
    expect(find.byType(CatalogTree), findsOneWidget);
    await tester.tap(find.widgetWithText(ListTile, 'Drinks'));
    await tester.pumpAndSettle();
    expect(find.byType(CatalogTree), findsNothing);
    expect(controller.section.value, 'drinks');
    expect(tester.takeException(), isNull);
  });

  test(
    'sales controller can initialize before a catalog is available',
    () async {
      await Get.delete<SaleController>();
      register.snapshot.value = {
        'context': {
          'profile': {'config': {}},
        },
      };
      SaleBinding(register).dependencies();
      final historyController = Get.find<SaleController>();
      expect(historyController.section.value, isNull);
      expect(historyController.visibleFolders, isEmpty);
      expect(historyController.visibleProducts, isEmpty);
    },
  );

  testWidgets('failed settings saves keep the draft editable', (tester) async {
    await mount(tester);
    final message = RxnString();
    Get.dialog<void>(
      SaleScreenSettingDialogWidget(
        initialSettings: const SaleScreenSettings(),
        message: message,
        save: (_) async {
          message.value = 'LOCAL_ERROR';
          return false;
        },
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(settingsField('order-product-list-width'), '460');
    await tester.tap(find.widgetWithText(FilledButton, 'Save'));
    await tester.pumpAndSettle();
    expect(find.byType(SaleScreenSettingDialogWidget), findsOneWidget);
    expect(find.text('LOCAL_ERROR'.tr), findsOneWidget);
    final field = tester.widget<TextFormField>(
      settingsField('order-product-list-width'),
    );
    expect(field.controller!.text, '460');
    expect(field.enabled, isTrue);
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(service.screenSettings.value.orderProductListWidth, 350);
  });

  testWidgets('all layouts handle long Khmer labels at larger text sizes', (
    tester,
  ) async {
    final snapshot = catalogSnapshot();
    final catalog = snapshot['catalog'] as Json;
    catalog['nodes'] = [
      for (final node in jsonRows(catalog['nodes']))
        {...node, 'name_km': 'ប្រភេទផលិតផល និងមុខម្ហូបសម្រាប់ភ្ញៀវរបស់យើង'},
    ];
    register.snapshot.value = snapshot;
    await mount(
      tester,
      size: const Size(1280, 900),
      language: 'km',
      scale: 1.6,
    );
    for (final layout in SaleScreenLayout.values) {
      service.screenSettings.value = SaleScreenSettings(layout: layout);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: layout.key);
    }
  });

  testWidgets('a narrow desktop clamps the wide order panel', (tester) async {
    expect(
      const SaleScreenSettings(catalogWidth: 360).effectiveCatalogWidth(480),
      180,
    );
    service.screenSettings.value = const SaleScreenSettings(
      orderProductListWidth: 600,
    );
    await mount(
      tester,
      size: const Size(850, 820),
      body: const Scaffold(body: SellView()),
    );
    final panel = tester.widget<SizedBox>(
      find.byKey(const ValueKey('sale-order-panel')),
    );
    expect(panel.width, 530);
    expect(tester.takeException(), isNull);
  });
}
