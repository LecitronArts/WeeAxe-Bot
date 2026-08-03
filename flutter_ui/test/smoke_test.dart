import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:weeaxe_bot_admin/main.dart';
import 'package:weeaxe_bot_admin/services/backend_process.dart';

void main() {
  testWidgets('renders administrator dashboard', (tester) async {
    final pendingBackend = Completer<BackendProcess>();
    await tester
        .pumpWidget(BotAdminApp(backendStarter: () => pendingBackend.future));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
