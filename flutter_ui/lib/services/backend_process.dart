import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:web_socket_channel/io.dart';
import 'backend_client.dart';

class BackendProcess {
  BackendProcess._(this._process, this.client);
  final Process _process;
  final BackendClient client;
  Future<void>? _stopFuture;

  static BackendProcess fromProcessForTesting(
          Process process, BackendClient client) =>
      BackendProcess._(process, client);

  static String findBackendEntry(Directory workingDirectory) {
    var directory = workingDirectory.absolute;
    while (true) {
      final candidate =
          File('${directory.path}${Platform.pathSeparator}backend.js');
      if (candidate.existsSync()) return candidate.path;
      final parent = directory.parent;
      if (parent.path == directory.path) break;
      directory = parent;
    }
    throw StateError(
        'Unable to locate backend.js from ${workingDirectory.path}');
  }

  static Future<String> prepareConfig(
      {required Directory dataDirectory, required File exampleConfig}) async {
    await dataDirectory.create(recursive: true);
    final config =
        File('${dataDirectory.path}${Platform.pathSeparator}config.json');
    if (!await config.exists()) {
      await exampleConfig.copy(config.path);
    }
    return config.path;
  }

  static Future<BackendProcess> start(
      {required String nodeExecutable,
      required String backendEntry,
      required String configPath}) async {
    Process? process;
    try {
      process = await Process.start(nodeExecutable,
          [backendEntry, '--control-port', '0', '--config', configPath]);
      final firstLine = await process.stdout
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .first
          .timeout(const Duration(seconds: 10));
      final decoded = jsonDecode(firstLine);
      if (decoded is! Map ||
          decoded['type'] != 'ready' ||
          decoded['port'] is! num) {
        throw StateError('backend did not report a listening port');
      }
      final channel = IOWebSocketChannel.connect(
        Uri(
            scheme: 'ws',
            host: '127.0.0.1',
            port: (decoded['port'] as num).toInt()),
      );
      await channel.ready.timeout(const Duration(seconds: 10));
      return BackendProcess._(process, BackendClient(channel));
    } catch (_) {
      if (process != null) {
        process.kill(ProcessSignal.sigterm);
        await process.exitCode
            .timeout(const Duration(seconds: 5), onTimeout: () => -1);
      }
      rethrow;
    }
  }

  Future<void> stop() => _stopFuture ??= _stop();

  Future<void> _stop() async {
    try {
      await client.request('shutdown').timeout(const Duration(seconds: 5));
    } catch (_) {}
    await client.close();
    _process.kill(ProcessSignal.sigterm);
    await _process.exitCode.timeout(const Duration(seconds: 5));
  }
}
