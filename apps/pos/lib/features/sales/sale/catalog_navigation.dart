import '../../../core/pos_api.dart';

/// The cached catalog is a scoped tree; no requests are needed to open folders.
class CatalogNavigation {
  CatalogNavigation(Json catalog, {this.rootId, this.restrictToRoot = false})
    : mode = catalog['mode'] as String? ?? 'category' {
    final source = jsonRows(catalog['nodes']);
    final allowed = <String>{};
    if (restrictToRoot && source.any((node) => node['id'] == rootId)) {
      allowed.add(rootId!);
      var added = true;
      while (added) {
        added = false;
        for (final node in source) {
          if (allowed.contains(node['parent_id']) &&
              allowed.add(node['id'] as String)) {
            added = true;
          }
        }
      }
    }
    nodes = restrictToRoot
        ? source
              .where((node) => allowed.contains(node['id']))
              .map(
                (node) =>
                    node['id'] == rootId ? {...node, 'parent_id': null} : node,
              )
              .toList()
        : source;
    byId = {for (final node in nodes) node['id'] as String: node};
    for (final node in nodes) {
      final parent = parentOf(node['id'] as String);
      (_childrenByParent[parent] ??= []).add(node);
    }
  }

  final String mode;
  final String? rootId;
  final bool restrictToRoot;
  final _childrenByParent = <String?, List<Json>>{};
  late final List<Json> nodes;
  late final Map<String, Json> byId;

  String? parentOf(String id) {
    final parent = byId[id]?['parent_id'] as String?;
    return parent != id && byId.containsKey(parent) ? parent : null;
  }

  List<Json> childrenOf(String? id) => _childrenByParent[id] ?? const [];

  Set<String> sectionIds(String id) {
    if (nodes.isEmpty && !restrictToRoot) return {id};
    if (!byId.containsKey(id)) return {};
    final ids = {id};
    final pending = [id];
    while (pending.isNotEmpty) {
      for (final child in childrenOf(pending.removeLast())) {
        final childId = child['id'] as String;
        if (ids.add(childId)) pending.add(childId);
      }
    }
    return ids;
  }

  /// The default menu provides scope, while its children start the visible UI.
  List<Json> get navigationRoots => childrenOf(restrictToRoot ? rootId : null);

  List<Json> pathTo(String? id) {
    final path = <Json>[];
    final visited = <String>{};
    while (id != null && visited.add(id) && byId.containsKey(id)) {
      path.add(byId[id]!);
      id = parentOf(id);
    }
    return path.reversed.toList();
  }

  Iterable<String> assignments(Json product) => mode == 'menu'
      ? (product['menu_ids'] as List? ?? const []).cast<String>()
      : [if (product['category_id'] case final String id) id];

  List<Json> scopedProducts(List<Json> products) => restrictToRoot
      ? products
            .where((product) => assignments(product).any(byId.containsKey))
            .toList()
      : products;

  /// Left navigation stops after immediate children; the grid browses deeper.
  List<({Json node, int depth})> treeRows(Set<String> expanded) {
    final rows = <({Json node, int depth})>[];
    final visited = <String>{};
    void visit(String? parent, int depth) {
      for (final node in childrenOf(parent)) {
        final id = node['id'] as String;
        if (!visited.add(id)) continue;
        rows.add((node: node, depth: depth));
        if (depth == 0 && expanded.contains(id)) visit(id, depth + 1);
      }
    }

    visit(restrictToRoot ? rootId : null, 0);
    return rows;
  }
}
