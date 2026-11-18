import 'dart:convert';

import 'package:drift/native.dart';
import 'package:emenu_pos/core/api_endpoint.dart';
import 'package:emenu_pos/core/pos_api.dart';
import 'package:emenu_pos/core/register_access.dart';
import 'package:emenu_pos/core/register_database.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('catalog sends the selected menu on every page', () async {
    final requests = <http.Request>[];
    final api = PosApi(
      'https://pos.example.test',
      client: MockClient((request) async {
        requests.add(request);
        final page = int.parse(request.url.queryParameters['page']!);
        return http.Response(
          jsonEncode({
            'products': [
              {'id': 'product-$page'},
            ],
            'nodes': [
              {
                'id': 'root',
                'parent_id': null,
                'image_url': 'https://assets.test/menu.jpg',
              },
            ],
            'has_more': page == 1,
          }),
          200,
        );
      }),
    );
    addTearDown(api.close);
    final result = await api.catalog('token', menuId: 'menu-id');
    expect(
      jsonRows(result['nodes']).single['image_url'],
      'https://assets.test/menu.jpg',
    );
    expect(jsonRows(result['products']).map((row) => row['id']), [
      'product-1',
      'product-2',
    ]);
    expect(requests.map((request) => request.url.queryParameters), [
      {'page': '1', 'page_size': '100', 'menu_id': 'menu-id'},
      {'page': '2', 'page_size': '100', 'menu_id': 'menu-id'},
    ]);
  });

  for (final (mode, defaultMenu, expected) in [
    ('menu', 'menu-id', 'menu-id'),
    ('menu', null, null),
    ('category', 'menu-id', null),
  ]) {
    test(
      'profile $mode catalog uses default menu $defaultMenu correctly',
      () async {
        final database = RegisterDatabase(NativeDatabase.memory());
        addTearDown(database.close);
        final paths = <String>[];
        final context = <String, dynamic>{
          'profile': {
            'config': {'catalog_mode': mode, 'default_menu_id': defaultMenu},
          },
        };
        final api = PosApi(
          'https://pos.example.test',
          client: MockClient((request) async {
            final path = request.url.path.substring(ApiEndpoint.prefix.length);
            paths.add(path);
            if (path == ApiEndpoint.catalog) {
              expect(request.url.queryParameters['menu_id'], expected);
            }
            final response = switch (path) {
              ApiEndpoint.context => context,
              ApiEndpoint.catalog => {'products': [], 'has_more': false},
              ApiEndpoint.tables => {'tables': [], 'has_more': false},
              ApiEndpoint.customers => {'customers': [], 'has_more': false},
              _ => throw StateError('Unexpected path $path'),
            };
            return http.Response(jsonEncode(response), 200);
          }),
        );
        addTearDown(api.close);
        final access = RegisterAccess(database);
        final snapshot = await access.prepareProfile(api, 'token');
        expect(paths.first, ApiEndpoint.context);
        expect(snapshot['context'], context);

        paths.clear();
        await access.prepareProfile(api, 'token', context: context);
        expect(paths, isNot(contains(ApiEndpoint.context)));
      },
    );
  }

  test('a rejected scoped menu remains an API error', () async {
    var calls = 0;
    final api = PosApi(
      'https://pos.example.test',
      client: MockClient((request) async {
        calls++;
        expect(request.url.queryParameters['menu_id'], 'removed-menu');
        return http.Response(
          jsonEncode({'code': 'NOT_FOUND', 'error': 'Menu not found'}),
          404,
        );
      }),
    );
    addTearDown(api.close);
    await expectLater(
      api.catalog('token', menuId: 'removed-menu'),
      throwsA(
        isA<PosApiError>().having((error) => error.status, 'status', 404),
      ),
    );
    expect(calls, 1);
  });
}
