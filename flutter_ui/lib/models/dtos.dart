class BackendResponse {
  const BackendResponse(
      {required this.id, required this.ok, required this.payload, this.error});
  final String id;
  final bool ok;
  final Map<String, dynamic> payload;
  final Map<String, dynamic>? error;

  factory BackendResponse.fromJson(Map<String, dynamic> json) {
    if (json['type'] != 'response' ||
        json['id'] is! String ||
        json['ok'] is! bool) {
      throw const FormatException('Invalid backend response');
    }
    return BackendResponse(
      id: json['id'] as String,
      ok: json['ok'] as bool,
      payload: Map<String, dynamic>.from((json['payload'] as Map?) ?? const {}),
      error: json['error'] == null
          ? null
          : Map<String, dynamic>.from(json['error'] as Map),
    );
  }
}

class BackendEvent {
  const BackendEvent(this.type, this.data);
  final String type;
  final Map<String, dynamic> data;
  factory BackendEvent.fromJson(Map<String, dynamic> json) {
    if (json['type'] is! String) {
      throw const FormatException('Invalid backend event');
    }
    return BackendEvent(
        json['type'] as String, Map<String, dynamic>.from(json));
  }
}
