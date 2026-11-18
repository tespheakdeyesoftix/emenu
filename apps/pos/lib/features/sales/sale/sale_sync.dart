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
        final job = await database.nextJob();
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
        ? await api.request(
            ApiEndpoint.sales,
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
      'note',
    ];
    if (draft['total_minor'] != sale.total ||
        draft['currency'] != sale.currency ||
        draft['secondary_exchange_rate'] != request['exchange_rate'] ||
        quoted.length != actual.length ||
        Iterable<int>.generate(quoted.length).any(
          (index) =>
              (quoted[index]['is_free'] == true) !=
                  (actual[index]['is_free'] == true) ||
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
