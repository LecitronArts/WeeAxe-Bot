# Weeaxe Bot

Weeaxe Bot is a local administrator console and a Mineflayer-powered music bot
for Minecraft Java servers. Players control the bot through in-game private
messages. Administrators use the Flutter Windows application to configure,
connect, search songs, and monitor playback.

## Requirements

- Node.js 22 or newer
- Flutter 3.44.8 or newer with the Windows desktop toolchain
- A Minecraft Java 1.21.10 test account and server for end-to-end validation

## Development

Install Node dependencies and run its checks:

```powershell
npm test
npm run check
```

Create a configuration file from `config.example.json`. The backend normally
receives its configuration path from the Flutter application, or can be started
directly for development:

```powershell
node backend.js --config data/config.json --control-port 0
```

The backend listens only on `127.0.0.1` and prints one JSON ready line with its
assigned port. Do not expose this control port to the network.

For Flutter development:

```powershell
Set-Location flutter_ui
flutter pub get
flutter analyze
flutter test
flutter build windows
```

When the standard Flutter storage or Pub endpoints are unavailable in mainland
China, use the documented mirrors for the current shell:

```powershell
$env:FLUTTER_STORAGE_BASE_URL = 'https://storage.flutter-io.cn'
$env:PUB_HOSTED_URL = 'https://pub.flutter-io.cn'
```

The Windows application launches Node using `NODE_EXECUTABLE`. In development,
set `BACKEND_ENTRY` to the absolute path of `backend.js` and `BOT_CONFIG` to
the absolute configuration path when the current directory is not the project
root.

## Security

- Keep `data/config.json` private. It can contain the bot login password.
- Keep song files under the configured song repository. The backend rejects
  traversal and symbolic-link escapes.
- The control server intentionally binds only to loopback.

See `docs/validation/manual-e2e-checklist.md` before using a real server.
