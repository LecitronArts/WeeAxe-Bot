const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('backend locates the keymap when Flutter starts it from flutter_ui', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'weeaxe-backend-'));
  const configPath = path.join(directory, 'config.json');
  const child = spawn(process.execPath, [path.join(root, 'backend.js'), '--config', configPath, '--control-port', '0'], {
    cwd: path.join(root, 'flutter_ui'),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(async () => {
    if (!child.killed) child.kill('SIGTERM');
    await once(child, 'exit').catch(() => {});
    await fs.rm(directory, { recursive: true, force: true });
  });

  const output = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const line = stdout.split(/\r?\n/).find(Boolean);
      if (line) resolve(line);
    });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('exit', (code) => reject(new Error(`backend exited ${code}: ${stderr}`)));
  });

  assert.equal(JSON.parse(output).type, 'ready');
});
