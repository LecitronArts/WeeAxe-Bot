const path = require('node:path');
const { createApp } = require('./src/app');
const args = process.argv.slice(2);
const value = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
(async () => {
  const app = await createApp({
    configPath: value('--config', path.join(__dirname, 'data', 'config.json')),
    keymapPath: path.join(__dirname, '键位文件.txt'),
    port: Number(value('--control-port', '0'))
  });
  const started = await app.start();
  process.stdout.write(`${JSON.stringify({ type: 'ready', port: started.port })}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.shutdown(); process.exit(0); });
})().catch((error) => { console.error(error); process.exitCode = 1; });
