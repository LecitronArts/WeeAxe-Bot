import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/services/backend_client.dart';
import 'package:weeaxe_bot_admin/state/app_controller.dart';

import 'support/test_web_socket_channel.dart';

void main() {
  test('shows backend log context in the visible log line', () async {
    final channel = TestWebSocketChannel();
    final controller = AppController(BackendClient(channel));
    addTearDown(() async {
      await controller.disposeAsync();
      await channel.dispose();
    });

    channel.incoming.add(jsonEncode({
      'type': 'log',
      'level': 'error',
      'message': 'main bot was kicked',
      'context': {'reason': 'message too long'},
    }));
    await Future<void>.delayed(Duration.zero);

    expect(controller.logs, ['error  main bot was kicked  {"reason":"message too long"}']);
  });
}
