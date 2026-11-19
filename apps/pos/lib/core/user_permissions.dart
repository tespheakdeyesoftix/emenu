import 'pos_api.dart';

bool allowsUserAction(Json context, String role, String permission) {
  if (role == 'owner') return true;
  final settings = jsonObject(jsonObject(context['operator'] ?? const {})['permissions'] ?? const {});
  final value = settings[permission];
  if (value is bool) return value;
  return role == 'manager' ||
      !const ['allow_start_working_day', 'allow_close_working_day'].contains(permission);
}

void requireUserAction(Json context, String role, String permission) {
  if (!allowsUserAction(context, role, permission)) {
    throw const PosApiError(403, 'PERMISSION_DENIED', 'You do not have permission for this action.');
  }
}
