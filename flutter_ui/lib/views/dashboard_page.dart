import 'package:flutter/material.dart';

import '../state/app_controller.dart';
import '../widgets/log_panel.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage(
      {super.key, required this.controller, required this.onOpenSettings});

  final AppController controller;
  final Future<void> Function() onOpenSettings;

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() action) async {
    try {
      await action();
    } on StateError catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.message.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          return Scaffold(
            appBar: AppBar(
              title: const Text('管理员控制台'),
              actions: [
                IconButton(
                    tooltip: '设置',
                    onPressed: () => widget.onOpenSettings(),
                    icon: const Icon(Icons.settings_outlined)),
              ],
            ),
            body: Padding(
              padding: const EdgeInsets.all(16),
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final panels = [
                    _connectionPanel(controller),
                    _libraryPanel(controller),
                    _logsPanel(controller),
                  ];
                  if (constraints.maxWidth < 900) {
                    return ListView(
                      children: [
                        SizedBox(height: 230, child: panels[0]),
                        const SizedBox(height: 12),
                        SizedBox(height: 480, child: panels[1]),
                        const SizedBox(height: 12),
                        SizedBox(height: 300, child: panels[2]),
                      ],
                    );
                  }
                  return Row(
                    children: [
                      Expanded(child: panels[0]),
                      const SizedBox(width: 12),
                      Expanded(flex: 2, child: panels[1]),
                      const SizedBox(width: 12),
                      Expanded(child: panels[2]),
                    ],
                  );
                },
              ),
            ),
          );
        },
      );

  Widget _connectionPanel(AppController controller) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('连接状态', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 20),
              Text(controller.connection,
                  style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('子 Bot 数量: ${controller.childBots}'),
              const Spacer(),
              Wrap(
                spacing: 8,
                children: [
                  FilledButton.icon(
                      onPressed: () => _run(controller.connect),
                      icon: const Icon(Icons.link),
                      label: const Text('连接')),
                  OutlinedButton.icon(
                      onPressed: () => _run(controller.disconnect),
                      icon: const Icon(Icons.link_off),
                      label: const Text('断开')),
                ],
              ),
            ],
          ),
        ),
      );

  Widget _libraryPanel(AppController controller) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('曲库与播放',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 10),
              TextField(
                controller: _search,
                onSubmitted: (query) =>
                    _run(() => controller.searchSongs(query)),
                decoration: InputDecoration(
                  prefixIcon: const Icon(Icons.search),
                  hintText: '搜索曲目',
                  suffixIcon: IconButton(
                    tooltip: '搜索曲目',
                    onPressed: () =>
                        _run(() => controller.searchSongs(_search.text)),
                    icon: const Icon(Icons.search),
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  itemCount: controller.searchResults.length,
                  itemBuilder: (context, index) {
                    final song = controller.searchResults[index];
                    return ListTile(
                      dense: true,
                      leading: const Icon(Icons.music_note),
                      title: Text(song, overflow: TextOverflow.ellipsis),
                      trailing: IconButton(
                        tooltip: '播放曲目',
                        onPressed: () => _run(() => controller.play(song)),
                        icon: const Icon(Icons.play_arrow),
                      ),
                    );
                  },
                ),
              ),
              Text(controller.song,
                  maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 6),
              LinearProgressIndicator(value: controller.progress),
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  tooltip: '停止播放',
                  onPressed: () => _run(controller.stop),
                  icon: const Icon(Icons.stop_circle_outlined),
                ),
              ),
            ],
          ),
        ),
      );

  Widget _logsPanel(AppController controller) => Card(
        child: Padding(
            padding: const EdgeInsets.all(12),
            child: LogPanel(entries: controller.logs)),
      );
}
