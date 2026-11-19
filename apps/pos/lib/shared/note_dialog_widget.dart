import 'package:flutter/material.dart';
import 'package:get/get.dart';

import '../core/register_database.dart';
import 'forms/reusable_reason_field.dart';

class NoteDialogWidget extends StatefulWidget {
  const NoteDialogWidget._({
    required this.title,
    required this.initial,
    required this.saved,
  });

  final String title;
  final String? initial;
  final List<String> saved;

  static Future<void> edit(
    BuildContext context, {
    required RegisterDatabase database,
    required String noteKey,
    required String title,
    required String? initial,
    required bool Function(String) apply,
  }) async {
    final saved = await database.savedNotes(noteKey);
    if (!context.mounted) return;
    final result = await showDialog<CartReason>(
      context: context,
      builder: (_) => NoteDialogWidget._(
        title: title,
        initial: initial,
        saved: saved,
      ),
    );
    if (result == null || !context.mounted || !apply(result.text)) return;
    if (result.remember && result.text.isNotEmpty) {
      await database.rememberNote(noteKey, result.text);
    }
  }

  @override
  State<NoteDialogWidget> createState() => _NoteDialogWidgetState();
}

class _NoteDialogWidgetState extends State<NoteDialogWidget> {
  late CartReason _note = (text: widget.initial?.trim() ?? '', remember: false);

  @override
  Widget build(BuildContext context) => AlertDialog(
    scrollable: true,
    title: Text(widget.title),
    content: SizedBox(
      width: 360,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: 6,
        children: [
          ReusableReasonField(
            reasons: widget.saved,
            initialReason: _note,
            label: 'cart_note'.tr,
            rememberLabel: 'cart_remember_note'.tr,
            showSavedState: true,
            maxLength: 500,
            maxLines: 3,
            autofocus: true,
            onChanged: (note) => setState(() => _note = note),
          ),
          if (_note.text.length > 500)
            Text(
              'cart_note_too_long'.tr,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text('back'.tr),
      ),
      FilledButton(
        onPressed: _note.text.length > 500
            ? null
            : () => Navigator.pop<CartReason>(context, _note),
        child: Text('save'.tr),
      ),
    ],
  );
}
