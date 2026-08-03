import 'package:flutter/material.dart';

import '../state/app_controller.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key, required this.controller});

  final AppController controller;

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _host;
  late final TextEditingController _port;
  late final TextEditingController _botName;
  late final TextEditingController _owner;
  late final TextEditingController _password;
  late final TextEditingController _repository;
  late final TextEditingController _reconnectDelay;
  late bool _allowPlay;
  late bool _allowStop;
  late bool _allowRide;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final settings = widget.controller.settings;
    final policy = Map<String, dynamic>.from(
        (settings['commandPolicy'] as Map?) ?? const {});
    _host =
        TextEditingController(text: settings['serverHost']?.toString() ?? '');
    _port = TextEditingController(
        text: settings['serverPort']?.toString() ?? '25565');
    _botName =
        TextEditingController(text: settings['mainBotName']?.toString() ?? '');
    _owner =
        TextEditingController(text: settings['botOwner']?.toString() ?? '');
    _password = TextEditingController(
        text: settings['loginPassword']?.toString() ?? '');
    _repository = TextEditingController(
        text: settings['songRepository']?.toString() ?? '');
    _reconnectDelay = TextEditingController(
        text: settings['reconnectDelayMs']?.toString() ?? '5000');
    _allowPlay = policy['allowPlay'] as bool? ?? true;
    _allowStop = policy['allowStop'] as bool? ?? true;
    _allowRide = policy['allowRide'] as bool? ?? true;
  }

  @override
  void dispose() {
    for (final controller in [
      _host,
      _port,
      _botName,
      _owner,
      _password,
      _repository,
      _reconnectDelay
    ]) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _saving = true);
    try {
      await widget.controller.saveSettings({
        'serverHost': _host.text.trim(),
        'serverPort': int.parse(_port.text),
        'mainBotName': _botName.text.trim(),
        'botOwner': _owner.text.trim(),
        'loginPassword': _password.text,
        'songRepository': _repository.text.trim(),
        'reconnectDelayMs': int.parse(_reconnectDelay.text),
        'commandPolicy': {
          'allowPlay': _allowPlay,
          'allowStop': _allowStop,
          'allowRide': _allowRide,
        },
      });
      if (mounted) {
        Navigator.of(context).pop();
      }
    } on StateError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message.toString())));
      }
    } finally {
      if (mounted) {
        setState(() => _saving = false);
      }
    }
  }

  String? _required(String? value) =>
      value == null || value.trim().isEmpty ? '此项不能为空' : null;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('设置')),
        body: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _field('服务器地址', _host, validator: _required),
              _field(
                '端口',
                _port,
                key: const Key('serverPort'),
                keyboardType: TextInputType.number,
                validator: (value) {
                  final port = int.tryParse(value ?? '');
                  return port == null || port < 1 || port > 65535
                      ? '端口必须在 1 到 65535 之间'
                      : null;
                },
              ),
              _field('主 Bot 名称', _botName, validator: _required),
              _field('管理员名称', _owner, validator: _required),
              _field('登录密码', _password, obscureText: true),
              _field('曲库目录', _repository, validator: _required),
              _field(
                '重连间隔（毫秒）',
                _reconnectDelay,
                keyboardType: TextInputType.number,
                validator: (value) =>
                    int.tryParse(value ?? '') == null || int.parse(value!) < 0
                        ? '请输入非负整数'
                        : null,
              ),
              const SizedBox(height: 12),
              SwitchListTile(
                  title: const Text('允许播放指令'),
                  value: _allowPlay,
                  onChanged: (value) => setState(() => _allowPlay = value)),
              SwitchListTile(
                  title: const Text('允许停止指令'),
                  value: _allowStop,
                  onChanged: (value) => setState(() => _allowStop = value)),
              SwitchListTile(
                  title: const Text('允许骑乘指令'),
                  value: _allowRide,
                  onChanged: (value) => setState(() => _allowRide = value)),
              const SizedBox(height: 12),
              Align(
                alignment: Alignment.centerRight,
                child: FilledButton.icon(
                  key: const Key('saveSettings'),
                  onPressed: _saving ? null : _save,
                  icon: const Icon(Icons.save_outlined),
                  label: const Text('保存设置'),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _field(
    String label,
    TextEditingController controller, {
    Key? key,
    TextInputType? keyboardType,
    bool obscureText = false,
    String? Function(String?)? validator,
  }) =>
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          key: key,
          controller: controller,
          keyboardType: keyboardType,
          obscureText: obscureText,
          validator: validator,
          decoration: InputDecoration(
              labelText: label, border: const OutlineInputBorder()),
        ),
      );
}
