import 'package:flutter/material.dart';
import 'package:get/get.dart';

typedef CartReason = ({String text, bool remember});

class ReusableReasonField extends StatefulWidget {
  const ReusableReasonField({
    super.key,
    required this.reasons,
    required this.onChanged,
    this.initialReason,
    this.label,
    this.autofocus = false,
    this.rememberLabel,
    this.showSavedState = false,
    this.maxLength = 250,
    this.maxLines = 1,
  });

  final List<String> reasons;
  final ValueChanged<CartReason> onChanged;
  final CartReason? initialReason;
  final String? label;
  final bool autofocus;
  final String? rememberLabel;
  final bool showSavedState;
  final int maxLength, maxLines;

  @override
  State<ReusableReasonField> createState() => _ReusableReasonFieldState();
}

class _ReusableReasonFieldState extends State<ReusableReasonField> {
  late final _input = TextEditingController(text: widget.initialReason?.text);
  late bool _remember = widget.initialReason?.remember ?? false;

  bool get _saved => widget.reasons.any(
    (reason) => reason.toLowerCase() == _input.text.trim().toLowerCase(),
  );

  void _notify() {
    widget.onChanged((text: _input.text.trim(), remember: _remember && !_saved));
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 4,
    children: [
      TextField(
        controller: _input,
        maxLength: widget.maxLength,
        maxLines: widget.maxLines,
        autofocus: widget.autofocus,
        decoration: InputDecoration(
          labelText: widget.label ?? 'reason'.tr,
          counterText: '',
        ),
        onChanged: (_) {
          setState(() {});
          _notify();
        },
      ),
      if (widget.reasons.isNotEmpty)
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            spacing: 6,
            children: [
              for (final reason in widget.reasons)
                ChoiceChip(
                  label: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 240),
                    child: Text(reason, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                  selected: _input.text.trim() == reason,
                  onSelected: (_) {
                    setState(() {
                      _input.text = reason;
                      _remember = false;
                    });
                    _notify();
                  },
                ),
            ],
          ),
        ),
      if (!_saved || widget.showSavedState)
        CheckboxListTile(
          dense: true,
          contentPadding: EdgeInsets.zero,
          title: Text(widget.rememberLabel ?? 'cart_remember_reason'.tr),
          value: _saved || _remember,
          onChanged: _saved
              ? null
              : (value) {
                  setState(() => _remember = value == true);
                  _notify();
                },
        ),
    ],
  );
}
