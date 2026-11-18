import 'dart:convert';

import '../../../core/pos_api.dart';
import '../../../core/register_database.dart';
import '../../../core/register_operating.dart';

Future<Json> recordRegisterReversal({
  required RegisterDatabase database,
  required String id,
  required String profileId,
  required RegisterActor actor,
  required Json context,
  required Json input,
  required DateTime time,
  RegisterOperating? store,
}) async {
  requireRegisterManager(actor);
  if ((context['capabilities'] as Map?)?['reversal_context_guard'] != true) {
    throw const PosApiError(
      409,
      'SERVER_UPGRADE_REQUIRED',
      'Refresh the register after the server supports guarded reversals.',
    );
  }
  final originalId = input['sale_id'];
  final reason = (input['reason'] as String?)?.trim();
  if (originalId is! String ||
      reason == null ||
      reason.isEmpty ||
      reason.length > 500) {
    throw const FormatException('REVERSAL_REASON_REQUIRED');
  }
  final original = await database.originalSale(profileId, originalId);
  if (original == null ||
      original.reversesSaleId != null ||
      original.total < 0) {
    throw const PosApiError(
      409,
      'SALE_NOT_REVERSIBLE',
      'Select an original paid sale.',
    );
  }
  if (await database.hasReversal(original.id)) throw alreadyReversed;
  final settlement = original.settlement == null
      ? null
      : jsonObject(jsonDecode(original.settlement!));
  if (settlement?['reversed_by_sale_id'] != null) throw alreadyReversed;
  final String serverId;
  final List<Json> originalPayments;
  if (settlement?['status'] == 'paid' &&
      settlement?['id'] is String &&
      settlement?['payments'] is List) {
    serverId = settlement!['id'] as String;
    originalPayments = jsonRows(settlement['payments']);
  } else {
    final checkout = store == null
        ? null
        : await database.checkoutEvent(original.id);
    if (checkout == null) {
      throw const PosApiError(
        409,
        'SYNC_REQUIRED',
        'Sync the original sale first.',
      );
    }
    serverId = original.id;
    final payload = jsonObject(
      jsonObject(jsonDecode(checkout.envelope))['payload'],
    );
    originalPayments = RegisterOperating.savedCheckoutPayments(payload);
  }
  final current = registerOperatingContext(context, time);
  final expected = jsonObject(input['expected_context']);
  if (current.entries.any((entry) => expected[entry.key] != entry.value)) {
    throw const PosApiError(
      409,
      'SALE_CONTEXT_CHANGED',
      'The working day or shift changed.',
    );
  }
  final config = jsonObject(jsonObject(context['profile'])['config']);
  if (config['working_day_enabled'] == true &&
      current['working_day_id'] == null) {
    throw const PosApiError(
      409,
      'WORKING_DAY_REQUIRED',
      'Open the working day.',
    );
  }
  if (config['cashier_shift_enabled'] == true && current['shift_id'] == null) {
    throw const PosApiError(
      409,
      'CASHIER_SHIFT_REQUIRED',
      'Open a cashier shift.',
    );
  }

  final request = jsonObject(jsonDecode(original.request));
  final receipt = request['receipt'] is Map
      ? jsonObject(request['receipt'])
      : <String, dynamic>{};
  final reversalPayments = [
    for (final payment in originalPayments)
      {
        ...payment,
        'entry_type': 'reversal',
        'amount_minor': -(payment['amount_minor'] as int),
      },
  ];
  final payload = {
    'original_sale_id': serverId,
    'reason': reason,
    'expected_context': current,
    'expected_total_minor': original.total,
  };
  await database.queueReversal(
    id: id,
    original: original,
    operatorId: actor.id,
    createdAt: time,
    request: {
      ...payload,
      'draft': {'expected_context': current},
      'quote': [
        for (final line in jsonRows(request['quote']))
          {
            ...line,
            for (final field in [
              'quantity',
              'subtotal_minor',
              'discount_minor',
              'tax_1_amount',
              'tax_2_amount',
              'tax_3_amount',
              'total_tax_amount',
              'tax_minor',
              'total_minor',
              'total_amount',
            ])
              if (line[field] is int) field: -(line[field] as int),
          },
      ],
      'payments': reversalPayments,
      'receipt': {
        ...receipt,
        'business_date': current['business_date'],
        'operator_name': actor.displayName,
        'payment_type_names': {
          for (final payment in originalPayments)
            payment['payment_type_id'] as String: payment['payment_type_name'],
        },
      },
    },
  );
  if (store != null) await store.reverseSale(id, payload, reversalPayments);
  return {'sale_id': id, 'reverses_sale_id': original.id};
}

const alreadyReversed = PosApiError(
  409,
  'SALE_ALREADY_REVERSED',
  'This sale already has a reversal.',
);
