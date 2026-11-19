import 'dart:async';
import 'dart:convert';
import 'dart:math';

import '../../../core/api_endpoint.dart';
import '../../../core/pos_api.dart';
import '../../../core/register_database.dart';

class SaleSync {
  SaleSync(this.database, this.api, this.withOperatorSession, {this.onError});

  final RegisterDatabase database;
  final PosApi api;
  final Future<void> Function(
    String operatorId,
    String? profileId,
    Future<void> Function(String token) operation,
  )
  withOperatorSession;
  final void Function(Object error)? onError;
  final Random _random = Random();
  Timer? _timer;
  Future<void>? _inFlight;

  void start() {
    _timer ??= Timer.periodic(const Duration(seconds: 3), (_) => wake());
    wake();
  }

  Future<void> wake() =>
      _inFlight ??= _flush().whenComplete(() => _inFlight = null);

  Future<void> close() async {
    _timer?.cancel();
    _timer = null;
    await _inFlight;
  }

  Future<void> _flush() async {
    try {
      while (true) {
        final event = await database.nextStoreEvent();
        if (event != null) {
          if (event.status != 'pending' ||
              event.retryAt.isAfter(DateTime.now())) {
            return;
          }
          if (!await _syncStoreEvent(event)) return;
          continue;
        }
        final submitted = await database.nextSubmittedOrder();
        final job = await database.nextJob();
        if (submitted != null &&
            (job == null ||
                await database.submittedOrderPrecedesSale(submitted, job))) {
          if (submitted.retryAt.isAfter(DateTime.now()) ||
              !await _syncSubmittedOrder(submitted)) {
            return;
          }
          continue;
        }
        if (job == null || job.retryAt.isAfter(DateTime.now())) return;
        try {
          await _sync(job);
        } on PosApiError catch (error) {
          final failure = error.status == 401
              ? const PosApiError(
                  401,
                  'SIGN_IN_REQUIRED',
                  'Sign in with your password again.',
                )
              : error;
          await database.recordSyncFailure(
            job,
            failure,
            _retryAt(failure, job.attempts),
          );
          if (failure.transient) return;
        } on TypeError {
          await database.recordSyncFailure(
            job,
            const PosApiError(
              400,
              'BAD_SERVER_DATA',
              'Check the stored sale and server reply.',
            ),
            null,
          );
        }
      }
    } catch (error) {
      onError?.call(error);
    }
  }

  Future<bool> _syncSubmittedOrder(SubmittedOrderJob job) async {
    try {
      await withOperatorSession(job.operatorId, job.profileId, (token) async {
        final context = await api.request(ApiEndpoint.context, token: token);
        if (jsonObject(context['profile'])['id'] != job.profileId ||
            jsonObject(context['operator'])['id'] != job.operatorId) {
          throw const PosApiError(
            403,
            'WRONG_REGISTER_SESSION',
            'Check the register and operator.',
          );
        }
        _requireOrderSubmission(context);
        final payload = jsonObject(jsonDecode(job.payload));
        _requireLineDetails(context, payload);
        final Json result;
        if (job.cancel) {
          final Json saved;
          try {
            saved = await api.request(
              ApiEndpoint.saleById(job.saleId),
              token: token,
            );
          } on PosApiError catch (error) {
            if (error.status == 404) return;
            rethrow;
          }
          if (saved['status'] == 'cancelled') return;
          result = await api.request(
            ApiEndpoint.cancelSaleFor(job.saleId),
            method: 'POST',
            token: token,
            commandId: job.commandId,
            body: {'reason': payload['reason'], 'revision': saved['revision']},
          );
        } else {
          if (payload['cancel_print_bill'] == true) {
            final saved = await api.request(ApiEndpoint.saleById(job.saleId), token: token);
            payload['revision'] = saved['revision'];
          }
          result = await api.request(
            ApiEndpoint.submitSaleFor(job.saleId),
            method: 'POST',
            token: token,
            commandId: job.commandId,
            body: payload,
          );
        }
        if (result['id'] != job.saleId ||
            result['status'] != (job.cancel ? 'cancelled' : payload['request_bill'] == true ? 'bill_requested' : 'submitted') ||
            (!job.cancel && payload.containsKey('note') &&
                result['note'] != payload['note'])) {
          throw const PosApiError(
            409,
            'BAD_SERVER_DATA',
            'Invalid order acknowledgment.',
          );
        }
      });
      await database.acknowledgeSubmittedOrder(job);
      return true;
    } on PosApiError catch (error) {
      final failure = error.status == 401
          ? const PosApiError(
              401,
              'SIGN_IN_REQUIRED',
              'Sign in with your password again.',
            )
          : error;
      final retry = _retryAt(failure, job.attempts);
      await database.failSubmittedOrder(job, failure, retry);
      if (retry == null) onError?.call(failure);
      return retry == null;
    } on TypeError {
      const failure = PosApiError(
        400,
        'BAD_SERVER_DATA',
        'Check the saved order and server reply.',
      );
      await database.failSubmittedOrder(job, failure, null);
      onError?.call(failure);
      return true;
    }
  }

  void _requireOrderSubmission(Json context) {
    if ((context['capabilities'] as Map?)?['order_line_history'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to synchronize order line history.',
      );
    }
  }

  bool _hasLineReason(Json payload, String field) =>
      jsonRows(payload['lines']).any((line) => line[field] != null);

  bool _hasItemDiscountDetails(Json payload) =>
      [...jsonRows(payload['lines']), ...jsonRows(payload['voided_lines'])].any(
        (line) => line['discount_bps'] != null || line['discount_note'] != null,
      );

  void _requireLineDetails(Json context, Json payload) {
    if (_hasLineReason(payload, 'price_change_reason') &&
        (context['capabilities'] as Map?)?['price_change_reasons'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to synchronize price change reasons.',
      );
    }
    if (_hasLineReason(payload, 'free_reason') &&
        (context['capabilities'] as Map?)?['free_item_reasons'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to synchronize free item reasons.',
      );
    }
    if (_hasItemDiscountDetails(payload) &&
        (context['capabilities'] as Map?)?['item_discount_details'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to synchronize item discount details.',
      );
    }
    if (jsonRows(payload['voided_lines']).isNotEmpty &&
        (context['capabilities'] as Map?)?['order_line_void_reasons'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to synchronize item deletion reasons.',
      );
    }
  }

  DateTime? _retryAt(PosApiError failure, int attempts) {
    if (!failure.transient) return null;
    final delay =
        failure.retryAfter ??
        Duration(
          seconds: min(300, 1 << min(attempts + 1, 9)) + _random.nextInt(3),
        );
    return DateTime.now().toUtc().add(delay);
  }

  Future<bool> _syncStoreEvent(StoreOperatingEvent event) async {
    final owner = event.recoveryOwnerId;
    try {
      await withOperatorSession(
        owner ?? event.operatorId,
        owner == null ? event.profileId : null,
        (token) async {
          final envelope = jsonObject(jsonDecode(event.envelope));
          final payload = jsonObject(envelope['payload'] ?? {});
          final isSale = event.kind == 'submit_sale' || event.kind == 'checkout';
          final hasNote = isSale && payload['note'] != null;
          if (event.kind == 'submit_sale' ||
              event.kind == 'cancel_sale' ||
              jsonRows(payload['voided_lines']).isNotEmpty ||
              _hasLineReason(payload, 'price_change_reason') ||
              _hasLineReason(payload, 'free_reason') ||
              _hasItemDiscountDetails(payload) ||
              hasNote) {
            final context = await api.request(
              ApiEndpoint.context,
              token: token,
            );
            _requireOrderSubmission(context);
            _requireLineDetails(context, payload);
            if (hasNote &&
                (context['capabilities'] as Map?)?['sale_notes'] != true) {
              throw const PosApiError(
                503,
                'SERVER_UPGRADE_REQUIRED',
                'Update the server to synchronize sale notes.',
              );
            }
          }
          if (event.kind == 'checkout' &&
              (payload['posting_date'] != null ||
                  (payload['table_id'] == null &&
                      payload['guest_cover'] != null))) {
            final context = await api.request(
              ApiEndpoint.context,
              token: token,
            );
            if ((context['capabilities'] as Map?)?['bill_information'] !=
                true) {
              throw const PosApiError(
                503,
                'SERVER_UPGRADE_REQUIRED',
                'Update the server to save bill dates and counter guest cover.',
              );
            }
          }
          final recovery = owner == null
              ? null
              : {
                  'profile_id':
                      event.profileId ??
                      (await database.installation())!.profileId,
                  'operator_id': event.operatorId,
                  'reason': event.recoveryReason,
                  'operation': envelope,
                };
          final result = await api.request(
            recovery == null
                ? ApiEndpoint.storeOperations
                : ApiEndpoint.recoverStoreOperations,
            method: 'POST',
            token: token,
            commandId: event.commandId,
            body: recovery ?? envelope,
          );
          final reversal = event.kind == 'reversal'
              ? jsonObject(envelope['payload'])
              : null;
          if (result['id'] != event.resourceId ||
              (event.kind == 'submit_sale' &&
                  result['status'] != (payload['request_bill'] == true ? 'bill_requested' : 'submitted')) ||
              (event.kind == 'cancel_sale' &&
                  result['status'] != 'cancelled') ||
              (isSale && payload.containsKey('note') &&
                  result['note'] != payload['note']) ||
              (reversal != null &&
                  (result['reverses_sale_id'] != reversal['original_sale_id'] ||
                      result['total_minor'] !=
                          -(reversal['expected_total_minor'] as int)))) {
            throw const PosApiError(
              409,
              'BAD_SERVER_DATA',
              'The operation acknowledgment does not match.',
            );
          }
          await database.acknowledgeStoreEvent(event, result);
        },
      );
      return true;
    } on PosApiError catch (error) {
      if (owner != null && error.code == 'STORE_OPERATOR_ACTIVE') {
        await database.retryAsOriginalOperator(event.commandId);
        return true;
      }
      final failure = error.status == 401
          ? const PosApiError(
              401,
              'SIGN_IN_REQUIRED',
              'Sign in with your password again.',
            )
          : error;
      await database.failStoreEvent(
        event,
        failure,
        _retryAt(failure, event.attempts),
      );
      return false;
    } on TypeError {
      await database.failStoreEvent(
        event,
        const PosApiError(400, 'BAD_SERVER_DATA', 'Check the saved operation.'),
        null,
      );
      return false;
    }
  }

  Future<void> _sync(SaleOutboxData job) async {
    final sale = await database.sale(job.saleId);
    await withOperatorSession(
      sale.operatorId,
      sale.profileId,
      (token) => _send(job, sale, token),
    );
  }

  Future<void> _send(SaleOutboxData job, LocalSale sale, String token) async {
    final context = await api.request(ApiEndpoint.context, token: token);
    if (jsonObject(context['profile'])['id'] != sale.profileId ||
        jsonObject(context['operator'])['id'] != sale.operatorId) {
      throw const PosApiError(
        403,
        'WRONG_REGISTER_SESSION',
        'Check the register and operator.',
      );
    }
    if (context['capabilities'] is! Map ||
        jsonObject(context['capabilities'])['sale_context_guard'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Waiting for a compatible POS server.',
      );
    }

    final request = jsonObject(jsonDecode(sale.request));
    if (sale.reversesSaleId != null) {
      final original = request['original_sale_id'] as String;
      final reversal = await api.request(
        ApiEndpoint.reverseSaleFor(original),
        method: 'POST',
        token: token,
        commandId: '${sale.id}_reverse',
        body: {
          'reason': request['reason'],
          'expected_context': request['expected_context'],
          'expected_total_minor': request['expected_total_minor'],
        },
      );
      if (reversal['reverses_sale_id'] != original ||
          reversal['total_minor'] != sale.total ||
          reversal['currency'] != sale.currency) {
        throw const PosApiError(
          409,
          'BAD_SERVER_DATA',
          'The reversal acknowledgment does not match.',
        );
      }
      await database.saveSettlement(sale.id, reversal);
      return;
    }
    final savedDraft = jsonObject(request['draft']);
    _requireLineDetails(context, savedDraft);
    final submitted = request['submitted_order'] == true;
    if (submitted) _requireOrderSubmission(context);
    if ((savedDraft['posting_date'] != null ||
            (savedDraft['table_id'] == null &&
                savedDraft['guest_cover'] != null)) &&
        jsonObject(context['capabilities'])['bill_information'] != true) {
      throw const PosApiError(
        503,
        'SERVER_UPGRADE_REQUIRED',
        'Update the server to save bill dates and counter guest cover.',
      );
    }
    final draft = job.serverDraft == null
        ? request['bill_requested'] == true
          ? await api.request(ApiEndpoint.saleById(sale.id), token: token)
          : await api.request(
              submitted ? ApiEndpoint.submitSaleFor(sale.id) : ApiEndpoint.sales,
              method: 'POST',
              token: token,
              commandId: '${sale.id}_draft',
              body: jsonObject(request['draft']),
            )
        : jsonObject(jsonDecode(job.serverDraft!));
    if (job.serverDraft == null) await database.saveServerDraft(sale.id, draft);
    final quoted = jsonRows(request['quote']);
    final actual = jsonRows(draft['lines']);
    const fields = [
      'product_id',
      'portion_id',
      'quantity',
      'unit_price_minor',
      'subtotal_minor',
      'tax_minor',
      'total_minor',
      'base_price_override_minor',
      'price_change_reason',
      'free_reason',
      'discount_bps',
      'discount_note',
      'note',
    ];
    if (draft['total_minor'] != sale.total ||
        draft['currency'] != sale.currency ||
        draft['secondary_exchange_rate'] != request['exchange_rate'] ||
        (savedDraft.containsKey('note') && draft['note'] != savedDraft['note']) ||
        quoted.length != actual.length ||
        Iterable<int>.generate(quoted.length).any(
          (index) =>
              (quoted[index]['is_free'] == true) !=
                  (actual[index]['is_free'] == true) ||
              (quoted[index]['discount_minor'] ?? 0) !=
                  (actual[index]['discount_minor'] ?? 0) ||
              fields.any(
                (field) => quoted[index][field] != actual[index][field],
              ),
        )) {
      throw const PosApiError(
        409,
        'PRICE_CHANGED',
        'The server quote differs from the saved sale.',
      );
    }
    final receipt = await api.request(
      ApiEndpoint.checkoutSaleFor(draft['id'] as String),
      method: 'POST',
      token: token,
      commandId: '${sale.id}_checkout',
      body: {
        'revision': draft['revision'],
        'expected_total_minor': sale.total,
        'expected_context': jsonObject(request['draft'])['expected_context'],
        if (savedDraft['posting_date'] != null)
          'posting_date': savedDraft['posting_date'],
        'payments': request['payments'],
      },
    );
    await database.saveSettlement(sale.id, receipt);
  }
}
