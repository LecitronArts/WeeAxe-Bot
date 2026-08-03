import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/services/backend_client.dart';
import 'package:weeaxe_bot_admin/state/app_controller.dart';
import 'package:weeaxe_bot_admin/views/dashboard_page.dart';

import 'support/test_web_socket_channel.dart';

void main() {
  testWidgets(
      'renders the Chinese administrator dashboard with controls and log copy tooltip',
      (tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final channel = TestWebSocketChannel();
    final controller = AppController(BackendClient(channel));
    controller.logs.add('后端已启动');
    addTearDown(() async {
      await controller.disposeAsync();
      await channel.dispose();
    });

    await tester.pumpWidget(MaterialApp(
        home: DashboardPage(
            controller: controller, onOpenSettings: () async {})));

    expect(find.text('管理员控制台'), findsOneWidget);
    expect(find.byTooltip('停止播放'), findsOneWidget);
    expect(find.byTooltip('复制日志'), findsOneWidget);
    expect(find.text('连接'), findsOneWidget);
  });
}
