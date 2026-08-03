const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadConfig, saveConfig, validateConfig, redactConfig } = require('../src/config');
const { createLogger } = require('../src/logger');

test('redacts the password and rejects a missing song repository', () => {
  assert.equal(redactConfig({ loginPassword: 'secret' }).loginPassword, '[redacted]');
  assert.throws(() => validateConfig({}), /songRepository/);
});

test('validates a complete configuration and applies optional defaults', () => {
  const config = validateConfig({
    serverHost: '127.0.0.1',
    serverPort: 25565,
    mainBotName: 'PianoBot',
    botOwner: 'Admin',
    loginPassword: '',
    songRepository: 'C:/songs'
  });

  assert.equal(config.reconnectDelayMs, 5000);
  assert.deepEqual(config.commandPolicy, { allowPlay: true, allowStop: true, allowRide: true });
});

test('creates a default configuration when the file is missing and saves atomically', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-config-'));
  const configPath = path.join(directory, 'config.json');
  t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));

  const defaults = await loadConfig(configPath);
  assert.equal(defaults.serverHost, '');
  assert.equal(defaults.songRepository, '');

  await saveConfig(configPath, { ...defaults, serverHost: 'localhost' });
  assert.equal((await loadConfig(configPath)).serverHost, 'localhost');
  assert.deepEqual(
    (await fs.promises.readdir(directory)).filter((entry) => entry.includes('.tmp')),
    []
  );
});

test('uses distinct temporary files for concurrent saves in the same millisecond', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-config-'));
  const configPath = path.join(directory, 'config.json');
  const originalNow = Date.now;
  const originalWriteFile = fs.promises.writeFile;
  const temporaryPaths = [];
  Date.now = () => 1;
  fs.promises.writeFile = async (filePath, ...args) => {
    temporaryPaths.push(filePath);
    return originalWriteFile.call(fs.promises, filePath, ...args);
  };
  t.after(() => {
    Date.now = originalNow;
    fs.promises.writeFile = originalWriteFile;
    return fs.promises.rm(directory, { recursive: true, force: true });
  });

  await assert.doesNotReject(() => Promise.all([
    saveConfig(configPath, { serverHost: 'first' }),
    saveConfig(configPath, { serverHost: 'second' })
  ]));
  assert.equal(new Set(temporaryPaths).size, 2);
  const stored = JSON.parse(await fs.promises.readFile(configPath, 'utf8'));
  assert.ok(['first', 'second'].includes(stored.serverHost));
  assert.deepEqual(
    (await fs.promises.readdir(directory)).filter((entry) => entry.includes('.tmp')),
    []
  );
});

test('logger emits structured events without passwords in context', () => {
  const events = [];
  const logger = createLogger((event) => events.push(event));

  logger.info('connected', { loginPassword: 'secret', nested: { loginPassword: 'also-secret' } });

  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'log');
  assert.equal(events[0].level, 'info');
  assert.equal(events[0].message, 'connected');
  assert.equal(events[0].context.loginPassword, '[redacted]');
  assert.equal(events[0].context.nested.loginPassword, '[redacted]');
  assert.ok(Number.isFinite(Date.parse(events[0].timestamp)));
});
