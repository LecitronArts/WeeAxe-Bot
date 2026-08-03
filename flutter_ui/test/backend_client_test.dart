import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/models/dtos.dart';
import 'package:weeaxe_bot_admin/services/backend_client.dart';

import 'support/test_web_socket_channel.dart';

void main() {
  test('connection closure fails pending requests and rejects new requests',
      () async {
    final channel = TestWebSocketChannel();
    final client = BackendClient(channel);
    final pending = client.request('connect');

    await channel.incoming.close();

    await expectLater(
        pending,
        throwsA(isA<StateError>().having(
            (error) => error.message, 'message', 'backend connection closed')));
    await expectLater(
        client.request('disconnect'),
        throwsA(isA<StateError>().having(
            (error) => error.message, 'message', 'backend connection closed')));
    unawaited(channel.outgoing.close());
  });

  test(
      'invalid backend JSON is reported as an error event without closing the client',
      () async {
    final channel = TestWebSocketChannel();
    final client = BackendClient(channel);
    final errors = <Object>[];
    final subscription = client.events.listen(errors.add);

    channel.incoming.add('{not json');
    await Future<void>.delayed(Duration.zero);

    expect(
      errors.single,
      isA<BackendEvent>().having((event) => event.type, 'type', 'error').having(
          (event) => event.data['code'], 'code', 'INVALID_BACKEND_MESSAGE'),
    );
    await subscription.cancel();
    await client.close();
    unawaited(channel.outgoing.close());
  });

  test('response decoding completes the matching request', () async {
    final channel = TestWebSocketChannel();
    final client = BackendClient(channel);
    final response = client.request('connect');

    channel.incoming.add(jsonEncode({
      'type': 'response',
      'id': 'r1',
      'ok': true,
      'payload': {'state': 'connecting'}
    }));

    expect((await response).payload['state'], 'connecting');
    await client.close();
    await channel.dispose();
  });
}
