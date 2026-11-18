import 'dart:async';
import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:http/http.dart' as http;

import 'api_endpoint.dart';

typedef Json = Map<String, dynamic>;

/// Category catalogs do not accept menu_id.
String? defaultCatalogMenuId(Json context) {
  final config = jsonObject(jsonObject(context['profile'])['config'] ?? {});
  final id = config['default_menu_id'];
  return config['catalog_mode'] == 'menu' && id is String && id.isNotEmpty
      ? id
      : null;
}

Json jsonObject(Object? value) => Map<String, dynamic>.from(value as Map);
Json jsonObjectFromString(String value) => jsonObject(jsonDecode(value));
List<Json> jsonRows(Object? value) =>
    (value as List? ?? const []).map(jsonObject).toList(growable: false);

bool allowsCashFloat(Json paymentType) =>
    (paymentType['allow_cash_float'] as bool?) ?? paymentType['kind'] == 'cash';

class PosApiError implements Exception {
  const PosApiError(this.status, this.code, this.message, {this.retryAfter});

  final int status;
  final String code;
  final String message;
  final Duration? retryAfter;

  bool get transient =>
      status == 0 ||
      status == 429 ||
      status >= 500 ||
      code == 'DEVICE_PROOF_EXPIRED';

  @override
  String toString() => message;
}

class PosApi {
  PosApi(String origin, {http.Client? client})
    : origin = parseOrigin(origin),
      _client = client ?? http.Client();

  static const authVersion = 'client-pbkdf2-sha256-v1';
  final Uri origin;
  final http.Client _client;

  static Uri parseOrigin(String input) {
    final uri = Uri.tryParse(input.trim());
    final loopback =
        uri != null &&
        const ['localhost', '127.0.0.1', '::1'].contains(uri.host);
    if (uri == null ||
        uri.host.isEmpty ||
        (uri.scheme != 'https' && !(uri.scheme == 'http' && loopback)) ||
        uri.userInfo.isNotEmpty ||
        (uri.path.isNotEmpty && uri.path != '/') ||
        uri.hasQuery ||
        uri.hasFragment) {
      throw const FormatException('Enter the API origin with HTTPS.');
    }
    return uri.replace(path: '');
  }

  static Future<String> passwordProof(String email, String password) async {
    final salt = utf8.encode(
      'angkor-emenu:$authVersion:${email.trim().toLowerCase()}',
    );
    final key = await Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: 120000,
      bits: 256,
    ).deriveKey(secretKey: SecretKey(utf8.encode(password)), nonce: salt);
    return (await key.extractBytes())
        .map((byte) => byte.toRadixString(16).padLeft(2, '0'))
        .join();
  }

  Future<Json> login(
    String slug,
    String email,
    String password, {
    String? username,
  }) async {
    final normalizedEmail = email.trim().toLowerCase();
    return request(
      ApiEndpoint.login,
      method: 'POST',
      body: {
        'business_slug': slug,
        'email': normalizedEmail,
        'username': ?username,
        'password_proof': await passwordProof(normalizedEmail, password),
        'auth_version': authVersion,
      },
    );
  }

  Future<String> resolveUsername(String username, String managerToken) async {
    final resolved = await request(
      ApiEndpoint.resolveUsername,
      method: 'POST',
      token: managerToken,
      body: {'username': username},
    );
    return resolved['email'] as String;
  }

  Future<Json> startSession(String token, String profileId) => request(
    ApiEndpoint.sessions,
    method: 'POST',
    token: token,
    body: {'profile_id': profileId},
  );

  Future<List<Json>> pages(String path, String collection, String token) async {
    final rows = <Json>[];
    for (var page = 1; ; page++) {
      final result = await request(
        path,
        token: token,
        query: {'page': '$page', 'page_size': '100'},
      );
      rows.addAll(jsonRows(result[collection]));
      if (result['has_more'] != true) return rows;
    }
  }

  Future<Json> catalog(String token, {String? menuId}) async {
    final products = <Json>[];
    for (var page = 1; ; page++) {
      final result = await request(
        ApiEndpoint.catalog,
        token: token,
        query: {'page': '$page', 'page_size': '100', 'menu_id': ?menuId},
      );
      products.addAll(jsonRows(result['products']));
      if (result['has_more'] != true) {
        return {...result, 'products': products};
      }
    }
  }

  Future<Json> activeSalesPage(String token, int page) => request(
    ApiEndpoint.sales,
    token: token,
    query: {'history': 'active', 'page': '$page', 'page_size': '100'},
  );

  Future<Json> request(
    String path, {
    String method = 'GET',
    String? token,
    String? commandId,
    Json? body,
    Map<String, String>? query,
  }) async {
    final request = http.Request(
      method,
      origin.replace(
        path: '${ApiEndpoint.prefix}$path',
        queryParameters: query,
      ),
    )..followRedirects = false;
    request.headers['Accept'] = 'application/json';
    if (token != null) request.headers['Authorization'] = 'Bearer $token';
    if (commandId != null) request.headers['Idempotency-Key'] = commandId;
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.bodyBytes = utf8.encode(jsonEncode(body));
    }
    final http.Response response;
    try {
      response = await (() async {
        return http.Response.fromStream(await _client.send(request));
      })().timeout(const Duration(seconds: 15));
    } on TimeoutException {
      throw const PosApiError(
        0,
        'TIMEOUT',
        'The server took too long to respond.',
      );
    } on http.ClientException {
      throw const PosApiError(0, 'OFFLINE', 'The server is unreachable.');
    }
    Json? data;
    try {
      data = jsonObject(jsonDecode(utf8.decode(response.bodyBytes)));
    } on FormatException {
      // A gateway can return a non-JSON error while the network recovers.
    } on TypeError {
      // Successful responses must be JSON objects.
    }
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        data != null) {
      return data;
    }
    final retrySeconds = int.tryParse(response.headers['retry-after'] ?? '');
    throw PosApiError(
      response.statusCode,
      data?['code'] as String? ?? 'UNEXPECTED_RESPONSE',
      data?['error'] as String? ??
          'The server returned an unexpected response.',
      retryAfter: retrySeconds == null ? null : Duration(seconds: retrySeconds),
    );
  }

  void close() => _client.close();
}
