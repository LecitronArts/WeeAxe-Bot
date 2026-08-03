import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/dtos.dart';

class BackendClient {
  BackendClient(this._channel) {
    _subscription = _channel.stream.listen(
      _onMessage,
      onError: (_, __) => _closeConnection(),
      onDone: _closeConnection,
    );
  }
  final WebSocketChannel _channel;
  final _events = StreamController<BackendEvent>.broadcast();
  final _pending = <String, Completer<BackendResponse>>{};
  late final StreamSubscription<dynamic> _subscription;
  int _nextId = 0;
  bool _closed = false;
  Future<void>? _closeFuture;
  Stream<BackendEvent> get events => _events.stream;

  void _onMessage(dynamic raw) {
    if (_closed) {
      return;
    }
    try {
      if (raw is! String) {
        throw const FormatException('Backend message must be text');
      }
      final decoded = jsonDecode(raw);
      if (decoded is! Map) {
        throw const FormatException('Backend message must be an object');
      }
      final message = Map<String, dynamic>.from(decoded);
      if (message['type'] == 'response') {
        final response = BackendResponse.fromJson(message);
        final completer = _pending.remove(response.id);
        if (completer != null && !completer.isCompleted) {
          completer.complete(response);
        }
      } else {
        _events.add(BackendEvent.fromJson(message));
      }
    } catch (error) {
      _events.add(BackendEvent('error', {
        'type': 'error',
        'code': 'INVALID_BACKEND_MESSAGE',
        'message': error.toString(),
      }));
    }
  }

  void _closeConnection() {
    if (_closed) {
      return;
    }
    _closed = true;
    for (final completer in _pending.values) {
      if (!completer.isCompleted) {
        completer.completeError(StateError('backend connection closed'));
      }
    }
    _pending.clear();
  }

  Future<BackendResponse> request(String command,
      [Map<String, dynamic> payload = const {}]) {
    if (_closed) {
      return Future.error(StateError('backend connection closed'));
    }
    final id = 'r${++_nextId}';
    final completer = Completer<BackendResponse>();
    _pending[id] = completer;
    try {
      _channel.sink
          .add(jsonEncode({'id': id, 'command': command, 'payload': payload}));
    } catch (_) {
      _pending.remove(id);
      completer.completeError(StateError('backend connection closed'));
      _closeConnection();
    }
    return completer.future;
  }

  Future<void> close() => _closeFuture ??= _close();

  Future<void> _close() async {
    _closeConnection();
    await _subscription.cancel();
    await _channel.sink.close();
    await _events.close();
  }
}
