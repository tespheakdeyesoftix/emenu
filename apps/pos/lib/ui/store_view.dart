import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:get/get.dart';

import '../core/register_database.dart';
import '../features/register/register_controller.dart';
import 'shared_widgets.dart';

class StoreView extends StatefulWidget {
  const StoreView(this.controller, {super.key});

  final RegisterController controller;

  @override
  State<StoreView> createState() => _StoreViewState();
}

class _StoreViewState extends State<StoreView> {
  final code = TextEditingController();
  final label = TextEditingController();
  List<String> addresses = [];
  List<StoreDevice> devices = [];
  String? address;
  String? invitation;
  bool copied = false;

  RegisterController get register => widget.controller;

  @override
  void initState() {
    super.initState();
    if (register.hosting.value) _load();
  }

  Future<void> _load() async {
    final choices = await register.network.addresses();
    final active = await register.network.host?.devices() ?? <StoreDevice>[];
    if (!mounted) return;
    setState(() {
      addresses = choices;
      address = choices.contains(address) ? address : choices.first;
      devices = active;
    });
  }

  Future<void> _enable() async {
    await register.enableStoreHost();
    if (register.hosting.value) await _load();
  }

  Future<void> _pair() async {
    if (label.text.trim().isEmpty) {
      register.message.value = 'TILL_NAME_REQUIRED';
      return;
    }
    await register.pairStore(code.text, label.text);
    if (mounted && register.paired.value) Navigator.of(context).pop();
  }

  Future<void> _revoke(StoreDevice device) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(device.name),
        content: Text('revoke_till'.tr),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text('back'.tr),
          ),
          RegisterButton(
            'remove',
            onPressed: () => Navigator.pop(context, true),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await register.revokeStoreDevice(device.id);
    await _load();
  }

  @override
  void dispose() {
    code.dispose();
    label.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Obx(() {
    final host = register.hosting.value;
    final till = register.paired.value;
    final busy = register.busy.value;
    return AlertDialog(
      title: Text('store_devices'.tr),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            spacing: 12,
            children: [
              RegisterNotice(register.message.value),
              if (till)
                Text('paired_till'.tr)
              else if (host) ...[
                if (register.storeOperations)
                  OutlinedButton(
                    onPressed: busy ? null : register.releaseOfflineOperations,
                    child: Text('release_store_operations'.tr),
                  )
                else
                  RegisterButton(
                    'enable_store_operations',
                    onPressed: busy ? null : register.enableOfflineOperations,
                  ),
                if (register.storeAuthorityPending)
                  RegisterNotice('STORE_AUTHORITY_PENDING'),
                if (addresses.isNotEmpty)
                  DropdownButtonFormField<String>(
                    initialValue: address,
                    decoration: InputDecoration(labelText: 'store_address'.tr),
                    items: addresses
                        .map(
                          (ip) => DropdownMenuItem(value: ip, child: Text(ip)),
                        )
                        .toList(),
                    onChanged: (value) => setState(() {
                      address = value;
                      invitation = null;
                    }),
                  ),
                RegisterButton(
                  'new_pairing_code',
                  onPressed: busy || address == null
                      ? null
                      : () {
                          setState(() {
                            invitation = register.network.host!
                                .invitation(address!)
                                .encode();
                            copied = false;
                          });
                        },
                ),
                if (invitation != null) ...[
                  Text('pairing_expiry'.tr),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.copy),
                    label: Text((copied ? 'copied' : 'copy_code').tr),
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: invitation!));
                      if (mounted) setState(() => copied = true);
                    },
                  ),
                ],
                TextButton.icon(
                  icon: const Icon(Icons.refresh),
                  label: Text('refresh'.tr),
                  onPressed: busy ? null : _load,
                ),
                for (final device in devices)
                  ListTile(
                    title: Text(device.name),
                    leading: const Icon(Icons.point_of_sale_outlined),
                    trailing: IconButton(
                      tooltip: 'revoke_till'.tr,
                      icon: const Icon(Icons.link_off),
                      onPressed: busy ? null : () => _revoke(device),
                    ),
                  ),
              ] else ...[
                RegisterButton(
                  'enable_store_host',
                  onPressed: busy ? null : _enable,
                ),
                const Divider(),
                TextField(
                  controller: label,
                  decoration: InputDecoration(labelText: 'till_label'.tr),
                  maxLength: 64,
                  enabled: !busy,
                ),
                TextField(
                  controller: code,
                  decoration: InputDecoration(labelText: 'pairing_code'.tr),
                  autocorrect: false,
                  enableSuggestions: false,
                  enabled: !busy,
                ),
                RegisterButton('pair_till', onPressed: busy ? null : _pair),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.of(context).pop(),
          child: Text('close'.tr),
        ),
      ],
    );
  });
}
