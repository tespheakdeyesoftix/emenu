import 'dart:convert';
import 'dart:math';

import 'package:cryptography/cryptography.dart';
import 'package:uuid/uuid.dart';

import 'pos_api.dart';

/// The private signing seed stays in this installation's OS credential vault.
class PosDeviceKey {
  PosDeviceKey._(this.id, this._seed);

  factory PosDeviceKey.generate() =>
      PosDeviceKey._(const Uuid().v4(), _randomBytes());

  factory PosDeviceKey.fromJson(Json data) => PosDeviceKey._(
    data['id'] as String,
    base64Decode(data['seed'] as String),
  );

  final String id;
  final List<int> _seed;
  late final Future<SimpleKeyPair> _key = Ed25519().newKeyPairFromSeed(_seed);

  Json toJson() => {'id': id, 'seed': base64Encode(_seed)};

  Future<Json> descriptor(String label) async {
    final publicKey = await (await _key).extractPublicKey();
    return {
      'device_id': id,
      'device_name': label,
      'public_key': _hex(publicKey.bytes),
    };
  }

  Future<Json> proof(String credentialId) async {
    final timestamp = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final nonce = _hex(_randomBytes());
    final message =
        'emenu.pos.device-session.v1\n$credentialId\n$timestamp\n$nonce';
    final signature = await Ed25519().sign(
      utf8.encode(message),
      keyPair: await _key,
    );
    return {
      'credential_id': credentialId,
      'issued_at': timestamp,
      'nonce': nonce,
      'signature': _hex(signature.bytes),
    };
  }

  static List<int> _randomBytes() {
    final random = Random.secure();
    return List.generate(32, (_) => random.nextInt(256));
  }

  static String _hex(List<int> bytes) =>
      bytes.map((byte) => byte.toRadixString(16).padLeft(2, '0')).join();
}
