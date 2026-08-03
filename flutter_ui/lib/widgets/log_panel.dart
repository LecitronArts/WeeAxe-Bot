import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class LogPanel extends StatelessWidget {
  const LogPanel({super.key, required this.entries});

  final List<String> entries;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                  child: Text('运行日志',
                      style: TextStyle(fontWeight: FontWeight.w600))),
              IconButton(
                tooltip: '复制日志',
                onPressed: entries.isEmpty
                    ? null
                    : () => Clipboard.setData(
                        ClipboardData(text: entries.reversed.join('\n'))),
                icon: const Icon(Icons.content_copy_outlined),
              ),
            ],
          ),
          const Divider(height: 1),
          Expanded(
            child: entries.isEmpty
                ? const Center(child: Text('暂无日志'))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: entries.length,
                    itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 4),
                      child: SelectableText(entries[index],
                          style: Theme.of(context).textTheme.bodySmall),
                    ),
                  ),
          ),
        ],
      );
}
