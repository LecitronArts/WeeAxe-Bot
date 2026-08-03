import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/services/backend_client.dart';
import 'package:weeaxe_bot_admin/services/backend_process.dart';

import 'support/test_web_socket_channel.dart';

void main() {
  test('finds backend.js from the flutter_ui development directory', () {
    final entry = BackendProcess.findBackendEntry(Directory.current);

    expect(entry, endsWith('${Platform.pathSeparator}backend.js'));
    expect(File(entry).existsSync(), isTrue);
  });

  test('creates the writable config from the example only when missing',
      () async {
    final root =
        await Directory.systemTemp.createTemp('weeaxe-flutter-process-');
    addTearDown(() => root.delete(recursive: true));
    final example =
        File('${root.path}${Platform.pathSeparator}config.example.json')
          ..writeAsStringSync('{"serverHost":""}');
    final data = Directory('${root.path}${Platform.pathSeparator}data');

    final configPath = await BackendProcess.prepareConfig(
        dataDirectory: data, exampleConfig: example);
    expect(await File(configPath).readAsString(), '{"serverHost":""}');

    await File(configPath).writeAsString('{"serverHost":"kept"}');
    await BackendProcess.prepareConfig(
        dataDirectory: data, exampleConfig: example);
    expect(await File(configPath).readAsString(), '{"serverHost":"kept"}');
  });

  test('stops a responsive backend without the five-second exit timeout',
      () async {
    final process =
        await Process.start('cmd', ['/c', 'ping', '-t', '127.0.0.1']);
    final channel = TestWebSocketChannel();
    final client = BackendClient(channel);
    final outgoing = channel.outgoing.stream.listen((_) {
      channel.incoming.add(jsonEncode({
        'type': 'response',
        'id': 'r1',
        'ok': true,
        'payload': {'state': 'stopped'},
      }));
    });
    final backend = BackendProcess.fromProcessForTesting(process, client);
    addTearDown(() async {
      await outgoing.cancel();
      process.kill(ProcessSignal.sigterm);
      await process.exitCode;
      await channel.dispose();
    });

    final stopwatch = Stopwatch()..start();
    await backend.stop();

    expect(stopwatch.elapsed, lessThan(const Duration(seconds: 2)));
    expect(await process.exitCode, isNot(0));
  });
}
