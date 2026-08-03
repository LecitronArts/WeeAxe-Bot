import 'dart:async';

import 'package:stream_channel/stream_channel.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class TestWebSocketChannel
    with StreamChannelMixin<Object?>
    implements WebSocketChannel {
  final incoming = StreamController<Object?>();
  final outgoing = StreamController<Object?>();

  @override
  int? get closeCode => null;

  @override
  String? get closeReason => null;

  @override
  String? get protocol => null;

  @override
  Future<void> get ready => Future.value();

  @override
  WebSocketSink get sink => _TestWebSocketSink(outgoing.sink);

  @override
  Stream<Object?> get stream => incoming.stream;

  Future<void> dispose() async {
    await incoming.close();
    unawaited(outgoing.close());
  }
}

class _TestWebSocketSink implements WebSocketSink {
  _TestWebSocketSink(this._delegate);

  final StreamSink<Object?> _delegate;

  @override
  Future<void> addStream(Stream<Object?> stream) => _delegate.addStream(stream);

  @override
  void add(Object? event) => _delegate.add(event);

  @override
  void addError(Object error, [StackTrace? stackTrace]) =>
      _delegate.addError(error, stackTrace);

  @override
  Future<void> close([int? closeCode, String? closeReason]) {
    unawaited(_delegate.close());
    return Future.value();
  }

  @override
  Future<void> get done => _delegate.done;
}
