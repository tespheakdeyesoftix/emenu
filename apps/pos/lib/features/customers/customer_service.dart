import 'dart:convert';
import 'dart:typed_data';

import 'package:get/get.dart';

import '../../core/pos_api.dart';
import '../register/register_controller.dart';
import '../sales/sale/customer/customer_directory.dart';

class CustomerService extends GetxService {
  CustomerService(this.register);

  final RegisterController register;
  final _photos = <String, Future<Uint8List?>>{};

  CustomerDirectory get directory =>
      CustomerDirectory(jsonRows(register.snapshot.value?['customers']));

  bool get canWrite {
    final context = register.snapshot.value?['context'] as Map?;
    return (context?['capabilities'] as Map?)?['customer_directory'] == true &&
        (!register.paired.value ||
            context?['store_customer_directory'] == true) &&
        context?['read_only'] != true &&
        register.online.value;
  }

  bool canDelete(Json row) =>
      row['is_walk_in'] != true &&
      row['is_walk_in'] != 1 &&
      row['id'] != register.config['default_customer_id'];

  Future<void> refresh() {
    _photos.clear();
    return register.refreshRegister();
  }

  Future<Uint8List?>? photo(String id) {
    final cached = _photos[id];
    if (cached != null || !register.online.value) return cached;
    if (_photos.length >= 40) _photos.remove(_photos.keys.first);
    return _photos[id] = _loadPhoto(id);
  }

  Future<Uint8List?> _loadPhoto(String id) async {
    try {
      final result = await register.requestCustomers({
        'operation': 'photo',
        'customer_id': id,
      });
      final image = result['image'];
      return image is String ? base64Decode(image) : null;
    } on PosApiError {
      return null;
    } on FormatException {
      return null;
    }
  }

  Future<List<Json>> groups() async => jsonRows(
    (await register.requestCustomers({
      'operation': 'groups',
    }))['customer_groups'],
  );

  Future<Json> save(String? id, Json fields, String commandId) {
    if (fields.containsKey('photo_upload') &&
        (register.context['capabilities'] as Map?)?['customer_photo_upload'] !=
            true) {
      throw const FormatException('CUSTOMER_PHOTO_UPGRADE');
    }
    if (fields.containsKey('photo_upload') || fields.containsKey('photo')) {
      _photos.remove(id);
    }
    return register.requestCustomers({
      'operation': id == null ? 'create' : 'update',
      'customer_id': ?id,
      'command_id': commandId,
      'fields': fields,
    });
  }

  Future<void> delete(String id, String commandId) async {
    await register.requestCustomers({
      'operation': 'delete',
      'customer_id': id,
      'command_id': commandId,
    });
    _photos.remove(id);
  }
}
