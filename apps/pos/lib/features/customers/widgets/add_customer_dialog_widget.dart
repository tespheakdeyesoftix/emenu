import 'dart:convert';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

import '../../../core/pos_api.dart';
import '../../../shared/customer_avatar.dart';
import '../../../shared/forms/app_selection_field.dart';
import '../../../shared/forms/app_text_form_field.dart';
import '../customer_service.dart';

class AddCustomerDialogWidget extends StatefulWidget {
  const AddCustomerDialogWidget({
    super.key,
    required this.service,
    this.customer,
  });

  final CustomerService service;
  final Json? customer;

  @override
  State<AddCustomerDialogWidget> createState() => _AddCustomerDialogState();
}

class _AddCustomerDialogState extends State<AddCustomerDialogWidget> {
  static const _contactFields = [
    ('phone_number', 'customer_phone', 50, TextInputType.phone),
    ('email', 'customer_email', 254, TextInputType.emailAddress),
    ('external_reference', 'customer_reference', 120, TextInputType.text),
  ];
  static const _genderLabels = {
    'Male': 'customer_male',
    'Female': 'customer_female',
  };

  final _form = GlobalKey<FormState>();
  late final _inputs = {
    for (final key in [
      'name',
      'customer_code',
      'address',
      ..._contactFields.map((field) => field.$1),
    ])
      key: TextEditingController(text: _initialValue(key)),
  };
  late String _group = _initialValue('customer_group_id');
  late String _gender = _initialValue('gender');
  late String _birthDate = _initialValue('dob');
  late bool _membership = _initialMembership;
  Uint8List? _pickedPhoto;
  bool _removePhoto = false;
  bool _pickingPhoto = false;
  String? _photoError;
  List<Json> _groups = [];
  bool _loadingGroups = false;
  bool _saving = false;
  String? _groupError;
  String? _error;
  String? _savePayload;
  String? _saveKey;
  late final String _deleteKey = const Uuid().v4();
  late final bool _editable;

  String? get _id => widget.customer?['id'] as String?;
  String _initialValue(String key) => widget.customer?[key] as String? ?? '';
  bool get _initialMembership =>
      widget.customer?['is_membership'] == 1 ||
      widget.customer?['is_membership'] == true;
  bool get _hasPhoto =>
      !_removePhoto &&
      (_pickedPhoto != null ||
          _initialValue('photo').isNotEmpty ||
          widget.customer?['has_uploaded_photo'] == 1 ||
          widget.customer?['has_uploaded_photo'] == true);

  @override
  void initState() {
    super.initState();
    _editable = widget.service.canWrite;
    if (_editable) _loadGroups();
  }

  @override
  void dispose() {
    for (final input in _inputs.values) {
      input.dispose();
    }
    super.dispose();
  }

  String _errorMessage(Object error) => switch (error) {
    PosApiError() => error.message,
    FormatException() => error.message.tr,
    _ => 'LOCAL_ERROR'.tr,
  };

  Future<void> _loadGroups() async {
    setState(() {
      _loadingGroups = true;
      _groupError = null;
    });
    try {
      final groups = await widget.service.groups();
      if (mounted) setState(() => _groups = groups);
    } catch (error) {
      if (mounted) setState(() => _groupError = _errorMessage(error));
    } finally {
      if (mounted) setState(() => _loadingGroups = false);
    }
  }

  Future<void> _save() async {
    if (_saving || _pickingPhoto || !_form.currentState!.validate()) return;
    final values = {
      for (final entry in _inputs.entries) entry.key: entry.value.text.trim(),
      'customer_group_id': _group,
      'gender': _gender,
      'dob': _birthDate,
    };
    final fields = <String, dynamic>{
      for (final entry in values.entries)
        if (_id == null || entry.value != _initialValue(entry.key))
          entry.key: entry.value.isEmpty ? null : entry.value,
      if (_membership != _initialMembership) 'is_membership': _membership,
      if (_pickedPhoto case final bytes?)
        'photo_upload': {
          'content_type': 'image/png',
          'image': base64Encode(bytes),
        }
      else if (_removePhoto)
        'photo': null,
    };
    if (fields.isEmpty) {
      Navigator.pop(context, widget.customer);
      return;
    }
    final payload = jsonEncode(fields);
    if (payload != _savePayload) {
      _savePayload = payload;
      _saveKey = const Uuid().v4();
    }
    await _submit(() => widget.service.save(_id, fields, _saveKey!));
  }

  Future<void> _pickPhoto() async {
    if (_saving || _pickingPhoto) return;
    setState(() {
      _pickingPhoto = true;
      _photoError = null;
    });
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        requestFullMetadata: false,
      );
      if (file == null || !mounted) return;
      final photo = await _resizePhoto(file.path);
      if (mounted) {
        setState(() {
          _pickedPhoto = photo;
          _removePhoto = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _photoError = 'customer_photo_unreadable');
    } finally {
      if (mounted) setState(() => _pickingPhoto = false);
    }
  }

  Future<Uint8List> _resizePhoto(String path) async {
    // Fit the avatar within the API's 256 KB limit even for dense PNGs.
    const edge = 240;
    final buffer = await ui.ImmutableBuffer.fromFilePath(path);
    ui.ImageDescriptor? descriptor;
    ui.Codec? codec;
    ui.Image? image;
    try {
      descriptor = await ui.ImageDescriptor.encoded(buffer);
      final landscape = descriptor.width >= descriptor.height;
      codec = await descriptor.instantiateCodec(
        targetWidth: landscape && descriptor.width > edge ? edge : null,
        targetHeight: !landscape && descriptor.height > edge ? edge : null,
      );
      image = (await codec.getNextFrame()).image;
      final png = (await image.toByteData(format: ui.ImageByteFormat.png))!;
      return png.buffer.asUint8List(png.offsetInBytes, png.lengthInBytes);
    } finally {
      image?.dispose();
      codec?.dispose();
      descriptor?.dispose();
      buffer.dispose();
    }
  }

  Future<void> _pickBirthDate() async {
    final today = DateUtils.dateOnly(DateTime.now());
    final first = DateTime(1);
    final current = DateTime.tryParse(_birthDate);
    final picked = await showDatePicker(
      context: context,
      helpText: 'customer_birth_date'.tr,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
      firstDate: first,
      lastDate: today,
      initialDate:
          current != null && !current.isBefore(first) && !current.isAfter(today)
          ? current
          : today,
    );
    if (mounted && picked != null) {
      setState(() => _birthDate = picked.toIso8601String().substring(0, 10));
    }
  }

  Future<void> _delete() async {
    final id = _id;
    if (id == null || _saving) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('customer_delete'.tr),
        content: Text(
          'customer_delete_confirm'.trParams({'name': _initialValue('name')}),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('cancel'.tr),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text('cart_delete'.tr),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    await _submit(() async {
      await widget.service.delete(id, _deleteKey);
      return null;
    });
  }

  Future<void> _submit(Future<Json?> Function() action) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final result = await action();
      if (mounted) Navigator.pop(context, result);
    } catch (error) {
      if (mounted) setState(() => _error = _errorMessage(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _textField(
    String key,
    String label,
    int limit,
    TextInputType type,
    bool enabled, {
    String? requiredError,
    int lines = 1,
  }) => AppTextFormField(
    controller: _inputs[key],
    enabled: enabled,
    maxLines: lines,
    maxLength: limit,
    keyboardType: type,
    decoration: InputDecoration(
      labelText: '${label.tr}${requiredError == null ? '' : ' *'}',
      counterText: '',
    ),
    validator: requiredError == null
        ? null
        : (value) => (value ?? '').trim().isEmpty ? requiredError.tr : null,
  );

  Widget _photoField(bool enabled) => Row(
    spacing: 12,
    children: [
      CustomerAvatar(
        customer: _removePhoto ? null : widget.customer,
        preview: _pickedPhoto,
        size: 64,
      ),
      if (_editable)
        Expanded(
          child: Wrap(
            spacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.file_upload_outlined),
                label: Text('customer_upload_photo'.tr),
                onPressed: enabled ? _pickPhoto : null,
              ),
              if (_hasPhoto)
                IconButton(
                  icon: const Icon(Icons.close),
                  tooltip: 'customer_remove_photo'.tr,
                  onPressed: enabled
                      ? () => setState(() {
                          _pickedPhoto = null;
                          _removePhoto = _id != null;
                          _photoError = null;
                        })
                      : null,
                ),
            ],
          ),
        ),
    ],
  );

  Widget _genderField(bool enabled) => AppSelectionField<String>(
    key: ValueKey(_gender),
    initialValue: _genderLabels.containsKey(_gender) ? _gender : null,
    isExpanded: true,
    decoration: InputDecoration(
      labelText: 'customer_gender'.tr,
      suffixIcon: enabled && _gender.isNotEmpty
          ? IconButton(
              icon: const Icon(Icons.clear),
              tooltip: 'customer_clear_gender'.tr,
              onPressed: () => setState(() => _gender = ''),
            )
          : null,
    ),
    items: [
      for (final item in _genderLabels.entries)
        DropdownMenuItem(value: item.key, child: Text(item.value.tr)),
    ],
    onChanged: enabled
        ? (value) => setState(() => _gender = value ?? '')
        : null,
  );

  Widget _dateField(BuildContext context, bool enabled) {
    final date = DateTime.tryParse(_birthDate);
    return Row(
      children: [
        Expanded(
          child: InkWell(
            onTap: enabled ? _pickBirthDate : null,
            child: InputDecorator(
              decoration: InputDecoration(
                labelText: 'customer_birth_date'.tr,
                prefixIcon: const Icon(Icons.calendar_today_outlined),
                enabled: enabled,
              ),
              isEmpty: _birthDate.isEmpty,
              child: Text(
                date == null
                    ? _birthDate
                    : MaterialLocalizations.of(context).formatMediumDate(date),
              ),
            ),
          ),
        ),
        if (enabled && _birthDate.isNotEmpty)
          IconButton(
            tooltip: 'shift_clear_date'.tr,
            onPressed: () => setState(() => _birthDate = ''),
            icon: const Icon(Icons.clear),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = _editable && !_saving && !_pickingPhoto;
    final groupOptions = {
      '': 'customer_no_group'.tr,
      if (_group.isNotEmpty)
        _group: widget.customer?['customer_group_name'] as String? ?? _group,
      for (final row in _groups) row['id'] as String: row['name'] as String,
    };
    return PopScope(
      canPop: !_saving,
      child: AlertDialog(
        title: Text(
          (_id == null
                  ? 'add_customer'
                  : _editable
                  ? 'customer_edit'
                  : 'customer_details')
              .tr,
        ),
        content: SizedBox(
          width: 460,
          child: SingleChildScrollView(
            child: Form(
              key: _form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 12,
                children: [
                  _photoField(enabled),
                  if (_saving || _pickingPhoto) const LinearProgressIndicator(),
                  if (_photoError case final error?)
                    Text(
                      error.tr,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  if (_error case final String error)
                    Text(
                      error,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  _textField(
                    'name',
                    'customer_name',
                    120,
                    TextInputType.name,
                    enabled,
                    requiredError: 'customer_name_required',
                  ),
                  Column(
                    children: [
                      CheckboxListTile(
                        dense: true,
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        title: Text('customer_membership'.tr),
                        value: _membership,
                        onChanged: enabled
                            ? (value) =>
                                  setState(() => _membership = value ?? false)
                            : null,
                      ),
                      _textField(
                        'customer_code',
                        'customer_code',
                        120,
                        TextInputType.text,
                        enabled,
                        requiredError: _membership
                            ? 'customer_member_code_required'
                            : null,
                      ),
                    ],
                  ),
                  for (final (key, label, limit, type) in _contactFields)
                    _textField(key, label, limit, type, enabled),
                  _genderField(enabled),
                  _dateField(context, enabled),
                  _textField(
                    'address',
                    'customer_address',
                    1000,
                    TextInputType.streetAddress,
                    enabled,
                    lines: 2,
                  ),
                  AppSelectionField<String>(
                    label: 'customer_group',
                    initialValue: _group,
                    isExpanded: true,
                    items: [
                      for (final entry in groupOptions.entries)
                        DropdownMenuItem(
                          value: entry.key,
                          child: Text(
                            entry.value,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: enabled && !_loadingGroups && _groupError == null
                        ? (value) => setState(() => _group = value ?? '')
                        : null,
                  ),
                  if (_loadingGroups) const LinearProgressIndicator(),
                  if (_groupError case final String error)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(
                        error,
                        style: TextStyle(color: theme.colorScheme.error),
                      ),
                      trailing: IconButton(
                        onPressed: enabled ? _loadGroups : null,
                        tooltip: 'refresh'.tr,
                        icon: const Icon(Icons.refresh),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
        actions: [
          if (_editable &&
              widget.customer != null &&
              widget.service.canDelete(widget.customer!))
            IconButton(
              tooltip: 'customer_delete'.tr,
              onPressed: enabled ? _delete : null,
              color: theme.colorScheme.error,
              icon: const Icon(Icons.delete_outline),
            ),
          TextButton(
            onPressed: _saving ? null : () => Navigator.pop(context),
            child: Text((_editable ? 'cancel' : 'close').tr),
          ),
          if (_editable)
            FilledButton(
              onPressed: enabled ? _save : null,
              child: Text('save'.tr),
            ),
        ],
      ),
    );
  }
}
