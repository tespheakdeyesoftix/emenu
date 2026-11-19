import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../../core/pos_api.dart';
import '../../../core/pricing.dart';
import '../../../core/register_database.dart';
import '../../../core/register_history_scope.dart';
import '../../../core/register_operating.dart' show registerLocalDate;
import '../../../shared/empty_state_widget.dart';
import '../sale_controller.dart';
import '../table/widgets/table_status_label.dart' show tableStatusColor;
import 'sale_detail_dialog_widget.dart';
import 'sale_history_entry.dart';

class SalesHistoryView extends StatefulWidget {
  const SalesHistoryView({super.key});

  @override
  State<SalesHistoryView> createState() => _SalesHistoryViewState();
}

class _SalesHistoryViewState extends State<SalesHistoryView> {
  final _controller = Get.find<SaleController>();
  final _tableScroll = ScrollController();
  late final _register = _controller.service.register;
  late final Worker _contextWorker;
  late final Timer _timer;
  StreamSubscription<RegisterHistory>? _watch;
  RegisterHistoryScope? _scope;
  (String?, (String, RegisterHistoryPeriod, String)?, bool)? _selection;
  Object _generation = Object();
  var _tab = SaleHistoryStatus.all;
  RegisterHistory? _local;
  List<Json> _server = const [];
  var _localUnavailable = false;
  var _serverUnavailable = false;
  var _readingLocal = false;
  var _readingServer = false;
  DateTime? _lastServerRead;

  @override
  void initState() {
    super.initState();
    _contextWorker = everAll([
      _register.snapshot,
      _register.operator,
      _register.paired,
    ], (_) => _updateScope());
    _updateScope();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      _updateScope();
      if (_register.paired.value) unawaited(_loadPaired());
      final last = _lastServerRead;
      if (last == null || DateTime.now().difference(last).inSeconds >= 30) {
        unawaited(_loadServer());
      }
    });
  }

  void _updateScope() {
    if (!mounted) return;
    final actor = _register.operator.value?.id;
    final paired = _register.paired.value;
    final scope = _register.snapshot.value == null || actor == null
        ? null
        : RegisterHistoryScope.fromContext(
            _register.context,
            _register.operatingContext,
          );
    final selection = (actor, scope?.key, paired);
    if (_selection == selection) return;
    unawaited(_watch?.cancel());
    _watch = null;
    setState(() {
      _selection = selection;
      _scope = scope;
      _generation = Object();
      _tab = SaleHistoryStatus.all;
      _local = null;
      _server = const [];
      _localUnavailable = _serverUnavailable = false;
      _readingLocal = _readingServer = false;
      _lastServerRead = null;
    });
    if (scope == null) return;
    final generation = _generation;
    if (paired) {
      unawaited(_loadPaired());
    } else {
      _watch = _register.database
          .watchSalesHistory(scope)
          .listen(
            (data) {
              if (_current(generation)) {
                setState(() {
                  _local = data;
                  _localUnavailable = false;
                });
              }
            },
            onError: (Object _) {
              if (_current(generation)) {
                setState(() => _localUnavailable = true);
              }
            },
          );
    }
    unawaited(_loadServer());
  }

  bool _current(Object generation) =>
      mounted && identical(_generation, generation);

  Future<void> _loadPaired() async {
    final scope = _scope;
    final actor = _selection?.$1;
    if (scope == null || actor == null || _readingLocal) return;
    final generation = _generation;
    _readingLocal = true;
    try {
      final data = await _register.readSalesHistory(actor);
      if (!_current(generation)) return;
      if (!scope.matches(data['history_scope'])) {
        setState(() {
          _local = null;
          _localUnavailable = true;
        });
        return;
      }
      setState(() {
        _local = RegisterHistory.fromJson(data);
        _localUnavailable = false;
      });
    } catch (error) {
      if (!_current(generation)) return;
      setState(() {
        _localUnavailable = true;
        if (error is PosApiError &&
            (error.status == 401 || error.status == 403)) {
          _local = null;
        } else if (_local == null ||
            (error is PosApiError && error.status == 404)) {
          _local = _legacyPairedSales(scope);
        }
      });
    } finally {
      if (_current(generation)) _readingLocal = false;
    }
  }

  RegisterHistory _legacyPairedSales(RegisterHistoryScope scope) =>
      RegisterHistory(
        sales: [
          for (final (sale, job) in _register.pending)
            if (sale.profileId == scope.profileId &&
                _salePeriod(sale, scope) == scope.id)
              (sale, job),
        ],
        held: _register.heldBills
            .where((bill) => bill.profileId == scope.profileId)
            .toList(),
        reversalStatuses: {
          for (final (sale, job) in _register.pending)
            if (sale.profileId == scope.profileId)
              ?sale.reversesSaleId: job.status,
        },
      );

  Object? _salePeriod(LocalSale sale, RegisterHistoryScope scope) {
    final field = scope.period.operatingField;
    final draft = historyObject(decodeHistoryObject(sale.request)['draft']);
    return historyObject(draft['expected_context'])[field] ??
        decodeHistoryObject(sale.settlement)[field];
  }

  Future<void> _loadServer() async {
    final scope = _scope;
    final actor = _selection?.$1;
    if (scope == null || actor == null || _readingServer) return;
    final generation = _generation;
    _readingServer = true;
    _lastServerRead = DateTime.now();
    try {
      final rows = <Json>[];
      for (var page = 1; ; page++) {
        final reply = await _register.readSalesHistory(actor, serverPage: page);
        if (!_current(generation)) return;
        if (!scope.matches(reply['history_scope'])) {
          setState(() {
            _server = const [];
            _serverUnavailable = true;
          });
          return;
        }
        rows.addAll(jsonRows(reply['sales']));
        if (reply['has_more'] != true) break;
      }
      setState(() {
        _server = rows;
        _serverUnavailable = false;
      });
    } catch (error) {
      if (!_current(generation)) return;
      setState(() {
        _serverUnavailable = true;
        if (error is PosApiError &&
            (error.status == 401 || error.status == 403)) {
          _server = const [];
        }
      });
    } finally {
      if (_current(generation)) _readingServer = false;
    }
  }

  void _refresh() {
    if (!mounted) return;
    if (_register.paired.value) unawaited(_loadPaired());
    unawaited(_loadServer());
  }

  void _open(SaleHistoryEntry entry, tz.Location zone) {
    final actor = _selection?.$1;
    if (actor == null) return;
    final generation = _generation;
    showDialog<void>(
      context: context,
      builder: (_) => SaleDetailDialogWidget(
        entry: entry,
        service: _controller.service,
        operatorId: actor,
        timeZone: zone,
        isCurrent: () => _current(generation),
        afterChange: _refresh,
        loadServer: entry.serverOnly
            ? () async {
                final detail = await _register.readSalesHistory(
                  actor,
                  saleId: entry.id,
                );
                if (!_current(generation)) {
                  throw StateError('Sales scope changed');
                }
                return detail;
              }
            : null,
      ),
    );
  }

  @override
  void dispose() {
    _timer.cancel();
    _contextWorker.dispose();
    unawaited(_watch?.cancel());
    _tableScroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Obx(() => _buildHistory(context));

  Widget _buildHistory(BuildContext context) {
    final registerScope = _scope;
    if (registerScope == null) {
      final needsShift =
          _register.snapshot.value != null &&
          _register.config['cashier_shift_enabled'] == true;
      return EmptyStateWidget(
        icon: Icons.schedule,
        title:
            (needsShift ? 'CASHIER_SHIFT_REQUIRED' : 'WORKING_DAY_REQUIRED').tr,
      );
    }
    final business = historyObject(_register.context['business']);
    final zone = tz.getLocation(business['timezone'] as String);
    final colors = Theme.of(context).colorScheme;
    final configured = historyObject(_register.config['table_status_colors']);
    final statusColors = {
      SaleHistoryStatus.all: colors.onSurfaceVariant,
      SaleHistoryStatus.submitted: tableStatusColor('occupied', configured),
      SaleHistoryStatus.hold: tableStatusColor('hold', configured),
      SaleHistoryStatus.billRequested: tableStatusColor(
        'bill_requested',
        configured,
      ),
      SaleHistoryStatus.closed: colors.primary,
      SaleHistoryStatus.voided: colors.error,
    };
    final rows = buildSalesHistory(
      _local ?? const RegisterHistory(),
      _server,
      registerScope,
      storeOperations: _register.storeOperations,
      businessDate: (time) => registerLocalDate(_register.context, time),
    );
    final filtered = _tab == SaleHistoryStatus.all
        ? rows
        : rows.where((row) => row.status == _tab).toList();
    final partial = _localUnavailable || _serverUnavailable;
    final loading = _local == null && !_localUnavailable && rows.isEmpty;

    return LayoutBuilder(
      builder: (context, screen) {
        final cards = _controller.salesHistoryCards ?? (screen.maxWidth < 900);
        return Padding(
          padding: EdgeInsets.all(screen.maxWidth < 600 ? 12 : 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      (registerScope.period == RegisterHistoryPeriod.shift
                              ? 'sales_current_shift'
                              : 'sales_current_day')
                          .tr,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    tooltip: 'refresh'.tr,
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh),
                  ),
                  SegmentedButton<bool>(
                    showSelectedIcon: false,
                    segments: [
                      ButtonSegment(
                        value: false,
                        icon: const Icon(Icons.table_rows_outlined),
                        tooltip: 'sales_table_view'.tr,
                      ),
                      ButtonSegment(
                        value: true,
                        icon: const Icon(Icons.grid_view_outlined),
                        tooltip: 'sales_card_view'.tr,
                      ),
                    ],
                    selected: {cards},
                    onSelectionChanged: (choice) => setState(
                      () => _controller.salesHistoryCards = choice.single,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  spacing: 8,
                  children: [
                    for (final tab in SaleHistoryStatus.values)
                      ChoiceChip(
                        selected: _tab == tab,
                        showCheckmark: false,
                        selectedColor: Color.alphaBlend(
                          statusColors[tab]!.withValues(alpha: .12),
                          colors.surface,
                        ),
                        onSelected: (_) => setState(() => _tab = tab),
                        label: _TabTotal(
                          tab: tab,
                          rows: rows,
                          currency: business['currency'] as String,
                          color: statusColors[tab]!,
                        ),
                      ),
                  ],
                ),
              ),
              if (partial)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'sales_partial'.tr,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (_readingServer && _server.isEmpty && !partial)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text('sales_loading_server'.tr),
                ),
              const SizedBox(height: 12),
              Expanded(
                child: loading
                    ? const Center(child: CircularProgressIndicator())
                    : filtered.isEmpty
                    ? EmptyStateWidget(
                        icon: Icons.receipt_long_outlined,
                        title:
                            (_tab == SaleHistoryStatus.all
                                    ? 'no_sales'
                                    : 'sales_no_status')
                                .tr,
                      )
                    : cards
                    ? _SalesCards(
                        rows: filtered,
                        zone: zone,
                        statusColors: statusColors,
                        onOpen: (entry) => _open(entry, zone),
                      )
                    : _SalesTable(
                        rows: filtered,
                        zone: zone,
                        statusColors: statusColors,
                        onOpen: (entry) => _open(entry, zone),
                        controller: _tableScroll,
                      ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _TabTotal extends StatelessWidget {
  const _TabTotal({
    required this.tab,
    required this.rows,
    required this.currency,
    required this.color,
  });

  final SaleHistoryStatus tab;
  final List<SaleHistoryEntry> rows;
  final String currency;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final totals = salesHistoryTotals(rows, tab);
    final amounts = totals.keys.toList()..sort();
    final count = tab == SaleHistoryStatus.all
        ? rows.length
        : rows.where((row) => row.status == tab).length;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('${tab.label.tr} · $count', style: TextStyle(color: color)),
          Text(
            '${tab == SaleHistoryStatus.all ? "${'sales_net'.tr} " : ''}'
            '${amounts.isEmpty ? displayAmount(0, currency) : amounts.map((code) => displayAmount(totals[code]!, code)).join(' · ')}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _SalesCards extends StatelessWidget {
  const _SalesCards({
    required this.rows,
    required this.zone,
    required this.statusColors,
    required this.onOpen,
  });

  final List<SaleHistoryEntry> rows;
  final tz.Location zone;
  final Map<SaleHistoryStatus, Color> statusColors;
  final ValueChanged<SaleHistoryEntry> onOpen;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, size) {
      final columns = min(4, max(1, (size.maxWidth / 310).floor()));
      final style = Theme.of(context).textTheme;
      return GridView.builder(
        itemCount: rows.length,
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: columns,
          mainAxisExtent:
              166 * max(1, MediaQuery.textScalerOf(context).scale(1)),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
        ),
        itemBuilder: (context, index) {
          final entry = rows[index];
          return Card(
            margin: EdgeInsets.zero,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => onOpen(entry),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: _Cell(
                            '#${entry.reference}',
                            style: style.titleSmall,
                          ),
                        ),
                        Flexible(
                          child: _Cell(
                            displayAmount(entry.amount, entry.currency),
                            style: style.titleMedium,
                          ),
                        ),
                      ],
                    ),
                    _Cell(
                      salesActivityLabel(context, entry.activity, zone),
                      style: style.bodySmall,
                    ),
                    const SizedBox(height: 4),
                    _Cell(
                      entry.table ?? 'counter'.tr,
                      style: style.titleMedium,
                    ),
                    if (entry.customer case final customer?) _Cell(customer),
                    const Spacer(),
                    Row(
                      children: [
                        Expanded(
                          child: _HistoryStatus(
                            entry,
                            color: statusColors[entry.status]!,
                          ),
                        ),
                        const SizedBox(width: 6),
                        _Cell(
                          '${entry.quantity} ${'sales_items'.tr}',
                          style: style.bodySmall,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    },
  );
}

class _SalesTable extends StatelessWidget {
  const _SalesTable({
    required this.rows,
    required this.zone,
    required this.statusColors,
    required this.onOpen,
    required this.controller,
  });

  final List<SaleHistoryEntry> rows;
  final tz.Location zone;
  final Map<SaleHistoryStatus, Color> statusColors;
  final ValueChanged<SaleHistoryEntry> onOpen;
  final ScrollController controller;

  static const _widths = [2, 3, 2, 3, 3, 1, 2];

  Widget _columns(List<Widget> cells) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
    child: Row(
      spacing: 10,
      children: [
        for (var i = 0; i < cells.length; i++)
          Expanded(flex: _widths[i], child: cells[i]),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LayoutBuilder(
      builder: (context, size) => Scrollbar(
        controller: controller,
        thumbVisibility: size.maxWidth < 940,
        child: SingleChildScrollView(
          controller: controller,
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: max(940, size.maxWidth),
            height: size.maxHeight,
            child: Material(
              color: theme.colorScheme.surface,
              borderRadius: BorderRadius.circular(14),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  ColoredBox(
                    color: theme.colorScheme.surfaceContainerHighest,
                    child: _columns([
                      for (final key in const [
                        'sales_reference',
                        'sales_time',
                        'table',
                        'customer',
                        'sales_status',
                        'sales_items',
                        'total',
                      ])
                        _Cell(key.tr, style: theme.textTheme.labelLarge),
                    ]),
                  ),
                  Expanded(
                    child: ListView.separated(
                      primary: false,
                      padding: const EdgeInsets.only(bottom: 12),
                      itemCount: rows.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final entry = rows[index];
                        return InkWell(
                          onTap: () => onOpen(entry),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(minHeight: 58),
                            child: _columns([
                              _Cell(
                                '#${entry.reference}',
                                style: theme.textTheme.titleSmall,
                              ),
                              _Cell(
                                salesActivityLabel(
                                  context,
                                  entry.activity,
                                  zone,
                                ),
                              ),
                              _Cell(entry.table ?? 'counter'.tr),
                              _Cell(entry.customer ?? '—'),
                              _HistoryStatus(
                                entry,
                                color: statusColors[entry.status]!,
                              ),
                              _Cell('${entry.quantity}'),
                              _Cell(
                                displayAmount(entry.amount, entry.currency),
                                style: theme.textTheme.titleSmall,
                              ),
                            ]),
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryStatus extends StatelessWidget {
  const _HistoryStatus(this.entry, {required this.color});

  final SaleHistoryEntry entry;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final syncStatus =
        entry.sync?.status ??
        entry.orderSyncStatus ??
        (entry.serverOnly ? 'synced' : null);
    final syncIndicator = switch (syncStatus) {
      'synced' => (Icons.cloud_done_outlined, theme.colorScheme.primary),
      'pending' => (Icons.cloud_upload_outlined, theme.colorScheme.tertiary),
      'attention' => (Icons.error_outline, theme.colorScheme.error),
      _ => null,
    };
    final details = [
      if (entry.carryover) 'sales_carryover'.tr,
      if (entry.reversalStatus case final status?) status.tr,
      if (entry.sync case final sync?
          when sync.status != 'synced' && sync.status != entry.reversalStatus)
        sync.status.tr,
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          spacing: 6,
          children: [
            Flexible(
              child: _Cell(
                entry.status.label.tr,
                style: theme.textTheme.labelLarge?.copyWith(color: color),
              ),
            ),
            if (syncIndicator case (final icon, final iconColor))
              Tooltip(
                message: syncStatus!.tr,
                child: Icon(icon, color: iconColor, size: 18),
              ),
          ],
        ),
        if (details.isNotEmpty)
          _Cell(details.join(' · '), style: theme.textTheme.bodySmall),
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const _Cell(this.text, {this.style});
  final String text;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: style, maxLines: 1, overflow: TextOverflow.ellipsis);
}
