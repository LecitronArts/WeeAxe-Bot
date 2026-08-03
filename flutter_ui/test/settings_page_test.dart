import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/services/backend_client.dart';
import 'package:weeaxe_bot_admin/state/app_controller.dart';
import 'package:weeaxe_bot_admin/views/settings_page.dart';

import 'support/test_web_socket_channel.dart';

void main() {
  testWidgets('shows the full settings form and rejects an invalid server port',
      (tester) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final channel = TestWebSocketChannel();
    final controller = AppController(BackendClient(channel));
    addTearDown(() async {
      await controller.disposeAsync();
      await channel.dispose();
    });

    await tester
        .pumpWidget(MaterialApp(home: SettingsPage(controller: controller)));
    await tester.enterText(find.byKey(const Key('serverPort')), '70000');
    await tester.tap(find.byKey(const Key('saveSettings')).first);
    await tester.pump();

    expect(find.text('服务器地址'), findsOneWidget);
    expect(find.text('端口必须在 1 到 65535 之间'), findsOneWidget);
    expect(find.byType(Switch), findsNWidgets(3));
  });
}
