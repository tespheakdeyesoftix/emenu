import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:basic_utils/basic_utils.dart' as x509;
import 'package:crypto/crypto.dart';

import 'api_endpoint.dart';
import 'pos_api.dart';
import 'register_authority.dart';

String storeSecret() {
  final random = Random.secure();
  return base64UrlEncode(List.generate(32, (_) => random.nextInt(256)))
      .replaceAll('=', '');
}

String storeCredentialHash(String credential) =>
    sha256.convert(utf8.encode(credential)).toString();

class StoreCertificate {
  const StoreCertificate(this.pem, this.privateKey);

  final String pem;
  final String privateKey;

  factory StoreCertificate.generate() {
    final keys = x509.CryptoUtils.generateEcKeyPair();
    final secret = keys.privateKey as x509.ECPrivateKey;
    final csr = x509.X509Utils.generateEccCsrPem(
      {'CN': 'eMenu Store Register'},
      secret,
      keys.publicKey as x509.ECPublicKey,
    );
    final pem = x509.X509Utils.generateSelfSignedCertificate(
      secret,
      csr,
      1825,
      extKeyUsage: [x509.ExtendedKeyUsage.SERVER_AUTH],
      notBefore: DateTime.now().toUtc().subtract(const Duration(days: 1)),
    );
    return StoreCertificate(
      pem,
      x509.CryptoUtils.encodeEcPrivateKeyToPem(secret),
    );
  }

  factory StoreCertificate.fromJson(Json data) =>
      StoreCertificate(data['certificate'] as String, data['key'] as String);

  Json toJson() => {'certificate': pem, 'key': privateKey};

  String get fingerprint {
    final lines = const LineSplitter().convert(pem);
    final body = lines.where((line) => !line.startsWith('-----')).join();
    return sha256.convert(base64Decode(body)).toString();
  }

  SecurityContext serverContext() => SecurityContext(withTrustedRoots: false)
    ..minimumTlsProtocolVersion = TlsProtocolVersion.tls1_2
    ..useCertificateChainBytes(utf8.encode(pem))
    ..usePrivateKeyBytes(utf8.encode(privateKey));
}

class StoreEndpoint {
  StoreEndpoint(String address, this.fingerprint) : uri = _uri(address) {
    if (!RegExp(r'^[0-9a-f]{64}$').hasMatch(fingerprint)) {
      throw invalidPairingCode;
    }
  }

  final Uri uri;
  final String fingerprint;

  static Uri _uri(String input) {
    final uri = Uri.tryParse(input);
    if (uri == null ||
        uri.scheme != 'https' ||
        InternetAddress.tryParse(uri.host)?.type != InternetAddressType.IPv4 ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        !uri.hasPort ||
        uri.port < 1 ||
        uri.port > 65535 ||
        uri.path.isNotEmpty) {
      throw invalidPairingCode;
    }
    return uri;
  }
}

class StoreInvitation {
  const StoreInvitation(this.endpoint, this.secret);

  final StoreEndpoint endpoint;
  final String secret;

  factory StoreInvitation.parse(String input) {
    final code = input.trim();
    if (code.length > 512 || !code.startsWith('EMPOS1.')) {
      throw invalidPairingCode;
    }
    try {
      final data = jsonObject(
        jsonDecode(
          utf8.decode(base64Url.decode(base64Url.normalize(code.substring(7)))),
        ),
      );
      final secret = data['secret'] as String;
      if (!isStoreSecret(secret)) throw invalidPairingCode;
      return StoreInvitation(
        StoreEndpoint(data['url'] as String, data['pin'] as String),
        secret,
      );
    } on FormatException {
      throw invalidPairingCode;
    } on TypeError {
      throw invalidPairingCode;
    }
  }

  String encode() {
    final value = jsonEncode({
      'url': endpoint.uri.toString(),
      'pin': endpoint.fingerprint,
      'secret': secret,
    });
    return 'EMPOS1.${base64UrlEncode(utf8.encode(value)).replaceAll('=', '')}';
  }
}

bool isStoreSecret(String value) =>
    RegExp(r'^[a-zA-Z0-9_-]{43}$').hasMatch(value);

const invalidPairingCode = FormatException('INVALID_PAIRING_CODE');

/// Every credential is sent only over TLS pinned to the invitation certificate.
class StoreClient {
  StoreClient(this.endpoint)
    : _http = HttpClient(
        context: SecurityContext(withTrustedRoots: false)
          ..minimumTlsProtocolVersion = TlsProtocolVersion.tls1_2,
      ) {
    _http.findProxy = (_) => 'DIRECT';
    _http.connectionTimeout = const Duration(seconds: 4);
    _http.badCertificateCallback = (cert, host, port) =>
        host == endpoint.uri.host &&
        port == endpoint.uri.port &&
        cert.startValidity.isBefore(DateTime.now()) &&
        cert.endValidity.isAfter(DateTime.now()) &&
        sha256.convert(cert.der).toString() == endpoint.fingerprint;
  }

  final StoreEndpoint endpoint;
  final HttpClient _http;

  Future<Json> pair({
    required StoreInvitation invitation,
    required String attemptId,
    required String label,
    required String posToken,
  }) => _request(
    StoreApiEndpoint.pair,
    credential: invitation.secret,
    body: {'attempt_id': attemptId, 'label': label, 'pos_token': posToken},
  );

  Future<Json> enroll(String deviceCredential, String posToken) => _request(
    StoreApiEndpoint.enroll,
    credential: deviceCredential,
    body: {'pos_token': posToken},
  );

  Future<Json> state(
    String staffCredential, {
    String? snapshotVersion,
    bool reloadMenu = false,
  }) => _request(
    StoreApiEndpoint.state,
    credential: staffCredential,
    body: {
      'snapshot_version': snapshotVersion,
      if (reloadMenu) 'reload_menu': true,
    },
  );

  Future<Json> shiftManagement(String staffCredential, Json input) => _request(
    StoreApiEndpoint.shiftManagement,
    credential: staffCredential,
    body: input,
  );

  Future<Json> customerDirectory(String staffCredential, Json input) =>
      _request(
        StoreApiEndpoint.customerDirectory,
        credential: staffCredential,
        body: input,
      );

  Future<Json> salesHistory(
    String staffCredential, {
    int? serverPage,
    String? saleId,
  }) => _request(
    StoreApiEndpoint.salesHistory,
    credential: staffCredential,
    body: {'server_page': ?serverPage, 'sale_id': ?saleId},
  );

  Future<Json> command({
    required String staffCredential,
    required String id,
    required RegisterAction action,
    required Json body,
  }) => _request(
    StoreApiEndpoint.command,
    credential: staffCredential,
    body: {'id': id, 'action': action.name, 'payload': body},
  );

  Future<Json> _request(
    String path, {
    required String credential,
    required Json body,
  }) async {
    try {
      return await (() async {
        final request = await _http.postUrl(endpoint.uri.replace(path: path));
        request.followRedirects = false;
        request.headers.set(
          HttpHeaders.authorizationHeader,
          'Bearer $credential',
        );
        request.headers.contentType = ContentType.json;
        request.add(utf8.encode(jsonEncode(body)));
        final response = await request.close();
        final data = jsonObject(
          jsonDecode(await utf8.decoder.bind(response).join()),
        );
        if (response.statusCode != HttpStatus.ok) {
          throw PosApiError(
            response.statusCode,
            data['code'] as String,
            data['error'] as String,
          );
        }
        return data;
      })().timeout(const Duration(seconds: 20));
    } on HandshakeException {
      throw const PosApiError(
        0,
        'STORE_CERTIFICATE',
        'The store certificate could not be verified.',
      );
    } on IOException {
      throw const PosApiError(
        0,
        'STORE_UNREACHABLE',
        'The store register is unreachable.',
      );
    } on TimeoutException {
      throw const PosApiError(
        0,
        'STORE_UNREACHABLE',
        'The store register did not respond.',
      );
    } on FormatException {
      throw const PosApiError(
        0,
        'STORE_UNREACHABLE',
        'The store register response was interrupted.',
      );
    } on TypeError {
      throw const PosApiError(
        0,
        'STORE_UNREACHABLE',
        'The store register response was invalid.',
      );
    }
  }

  void close() => _http.close(force: true);
}
