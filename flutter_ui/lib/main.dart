import 'dart:async';
import 'dart:io';
import 'dart:ui' show AppExitResponse;

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';

import 'services/backend_process.dart';
import 'state/app_controller.dart';
import 'views/dashboard_page.dart';
import 'views/settings_page.dart';

void main() => runApp(const BotAdminApp());

typedef BackendStarter = Future<BackendProcess> Function();

class BotAdminApp extends StatelessWidget {
  const BotAdminApp({super.key, this.backendStarter});

  final BackendStarter? backendStarter;

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(colorSchemeSeed: Colors.teal, useMaterial3: true),
        home: _StartupPage(
            backendStarter: backendStarter ?? _startDefaultBackend),
      );
}

Future<BackendProcess> _startDefaultBackend() async {
  final entry = Platform.environment['BACKEND_ENTRY'] ??
      BackendProcess.findBackendEntry(Directory.current);
  final configPath =
      Platform.environment['BOT_CONFIG'] ?? await _defaultConfigPath(entry);
  return BackendProcess.start(
    nodeExecutable: Platform.environment['NODE_EXECUTABLE'] ?? 'node',
    backendEntry: entry,
    configPath: configPath,
  );
}

Future<String> _defaultConfigPath(String backendEntry) async {
  final support = await getApplicationSupportDirectory();
  final dataDirectory =
      Directory('${support.path}${Platform.pathSeparator}data');
  final example = File(
      '${File(backendEntry).parent.path}${Platform.pathSeparator}config.example.json');
  return BackendProcess.prepareConfig(
      dataDirectory: dataDirectory, exampleConfig: example);
}

class _StartupPage extends StatefulWidget {
  const _StartupPage({required this.backendStarter});

  final BackendStarter backendStarter;

  @override
  State<_StartupPage> createState() => _StartupPageState();
}

class _StartupPageState extends State<_StartupPage> {
  late final Future<BackendProcess> _backend;
  AppController? _controller;
  BackendProcess? _process;
  Future<void>? _shutdownFuture;
  late final AppLifecycleListener _lifecycle;

  @override
  void initState() {
    super.initState();
    _backend = widget.backendStarter();
    _lifecycle = AppLifecycleListener(onExitRequested: _onExitRequested);
  }

  Future<AppExitResponse> _onExitRequested() async {
    await _shutdown();
    return AppExitResponse.exit;
  }

  Future<void> _shutdown() => _shutdownFuture ??= _stopBackend();

  Future<void> _stopBackend() async {
    await _controller?.disposeAsync();
    await _process?.stop();
  }

  @override
  void dispose() {
    _lifecycle.dispose();
    unawaited(_shutdown());
    super.dispose();
  }

  Future<void> _openSettings() async {
    final controller = _controller;
    if (controller == null) return;
    try {
      await controller.loadSettings();
    } on StateError {
      return;
    }
    if (!mounted) return;
    await Navigator.of(context).push(MaterialPageRoute<void>(
        builder: (_) => SettingsPage(controller: controller)));
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<BackendProcess>(
        future: _backend,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Scaffold(
                body: Center(child: Text('后端启动失败：${snapshot.error}')));
          }
          if (!snapshot.hasData) {
            return const Scaffold(
                body: Center(child: CircularProgressIndicator()));
          }
          _process ??= snapshot.data!;
          _controller ??= AppController(snapshot.data!.client);
          return DashboardPage(
              controller: _controller!, onOpenSettings: _openSettings);
        },
      );
}
