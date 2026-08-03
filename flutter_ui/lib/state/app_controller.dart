import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/dtos.dart';
import '../services/backend_client.dart';

class AppController extends ChangeNotifier {
  AppController(this.client) {
    _subscription = client.events.listen(_onEvent);
  }

  final BackendClient client;
  late final StreamSubscription<BackendEvent> _subscription;
  String connection = '未连接';
  String song = '没有正在播放';
  double progress = 0;
  int childBots = 0;
  String? error;
  final logs = <String>[];
  List<String> searchResults = const [];
  Map<String, dynamic> settings = _defaultSettings();

  static Map<String, dynamic> _defaultSettings() => {
        'serverHost': '',
        'serverPort': 25565,
        'mainBotName': '',
        'botOwner': '',
        'loginPassword': '',
        'songRepository': '',
        'reconnectDelayMs': 5000,
        'commandPolicy': {
          'allowPlay': true,
          'allowStop': true,
          'allowRide': true,
        },
      };

  void _onEvent(BackendEvent event) {
    if (event.type == 'connectionStatus') {
      connection = event.data['state']?.toString() ?? connection;
      childBots = (event.data['childBotCount'] as num?)?.toInt() ?? childBots;
    }
    if (event.type == 'botPoolStatus') {
      childBots = (event.data['childBotCount'] as num?)?.toInt() ?? childBots;
    }
    if (event.type == 'playbackStatus') {
      song = event.data['songName']?.toString() ?? song;
      final total = (event.data['totalTicks'] as num?)?.toDouble() ?? 1;
      progress = (((event.data['tick'] as num?)?.toDouble() ?? 0) / total)
          .clamp(0, 1)
          .toDouble();
    }
    if (event.type == 'log') {
      logs.insert(0,
          '${event.data['level'] ?? 'info'}  ${event.data['message'] ?? ''}');
    }
    if (event.type == 'error') error = event.data['message']?.toString();
    if (logs.length > 1000) logs.removeLast();
    notifyListeners();
  }

  Future<BackendResponse> _request(String command,
      [Map<String, dynamic> payload = const {}]) async {
    final response = await client.request(command, payload);
    if (!response.ok) {
      final message = response.error?['message']?.toString() ?? '后端请求失败';
      error = message;
      notifyListeners();
      throw StateError(message);
    }
    return response;
  }

  Future<void> connect() async => _request('connect');
  Future<void> disconnect() async => _request('disconnect');
  Future<void> play(String relativePath) async =>
      _request('playSong', {'relativePath': relativePath});
  Future<void> stop() async => _request('stopPlayback');

  Future<void> searchSongs(String query) async {
    final response = await _request('searchSongs', {'query': query, 'page': 1});
    searchResults = ((response.payload['items'] as List?) ?? const [])
        .map((item) => item.toString())
        .toList();
    notifyListeners();
  }

  Future<void> loadSettings() async {
    settings =
        Map<String, dynamic>.from((await _request('getSettings')).payload);
    notifyListeners();
  }

  Future<void> saveSettings(Map<String, dynamic> next) async {
    settings = Map<String, dynamic>.from(
        (await _request('saveSettings', next)).payload);
    notifyListeners();
  }

  Future<void> disposeAsync() => _subscription.cancel();
}
