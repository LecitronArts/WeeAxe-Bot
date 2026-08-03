const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createBotManager } = require('../src/bot-manager');

function createFakeBot() {
  const bot = new EventEmitter();
  bot._client = { ended: false };
  bot.username = 'PianoBot';
  bot.chat = () => {};
  bot.quitCalls = 0;
  bot.quit = () => { bot.quitCalls += 1; bot._client.ended = true; };
  return bot;
}

function createManager({ onWhisper, logger = { error() {} }, sleep } = {}) {
  const created = [];
  const manager = createBotManager({
    mineflayer: { createBot: () => { const bot = createFakeBot(); created.push(bot); return bot; } },
    config: {
      serverHost: 'localhost',
      serverPort: 25565,
      mainBotName: 'PianoBot',
      loginPassword: '',
      reconnectDelayMs: 0,
      botOwner: 'Owner'
    },
    logger,
    onWhisper,
    sleep
  });

  return { manager, created };
}

test('reuses the existing main bot for repeated connect commands', async () => {
  const created = [];
  const manager = createBotManager({
    mineflayer: { createBot: () => { const bot = createFakeBot(); created.push(bot); return bot; } },
    config: { serverHost: 'localhost', serverPort: 25565, mainBotName: 'PianoBot', loginPassword: '', reconnectDelayMs: 0 },
    logger: { error() {} }
  });

  const first = manager.connect();
  const second = manager.connect();

  assert.equal(second, first);
  assert.equal(created.length, 1);
  await manager.disconnect();
  assert.equal(first.quitCalls, 1);
});

test('dispatches a main bot whisper from the configured owner', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('whisper', 'Owner', '/play song');
  await Promise.resolve();

  assert.deepEqual(received, [{ bot, username: 'Owner', message: '/play song' }]);
  await manager.disconnect();
});

test('ignores a main bot whisper sent by itself', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('whisper', 'PianoBot', '/play song');
  await Promise.resolve();

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('ignores a main bot whisper sent by me', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('whisper', 'me', '/play song');
  await Promise.resolve();

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('ignores a main bot whisper from a non-owner', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('whisper', 'Guest', '/play song');
  await Promise.resolve();

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('dispatches an owner command from the server private-message format', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('messagestr', '[Owner private -> me] #search piano');

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(received, [{ bot, username: 'Owner', message: '#search piano' }]);
  await manager.disconnect();
});

test('does not dispatch a private message addressed to another recipient', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('messagestr', '[Owner private -> AnotherBot] #search piano');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('ignores a server private-message command from a non-owner', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('messagestr', '[Guest private -> me] #search piano');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('dispatches one command when both private-message events are emitted', async () => {
  const received = [];
  const { manager } = createManager({ onWhisper: (command) => received.push(command) });
  const bot = manager.connect();

  bot.emit('whisper', 'Owner', '#search piano');
  bot.emit('messagestr', '[Owner private -> me] #search piano');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(received.length, 1);
  await manager.disconnect();
});

test('does not dispatch a child bot whisper', async () => {
  const received = [];
  const { manager, created } = createManager({ onWhisper: (command) => received.push(command) });
  manager.connect();
  await manager.getPlaybackBots(2);

  created[1].emit('whisper', 'Owner', '/play song');
  await Promise.resolve();

  assert.deepEqual(received, []);
  await manager.disconnect();
});

test('logs rejected player command callbacks', async () => {
  const errors = [];
  const { manager } = createManager({
    onWhisper: () => Promise.reject(new Error('command failed')),
    logger: { error: (...args) => errors.push(args) }
  });
  const bot = manager.connect();

  bot.emit('whisper', 'Owner', '/play song');
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(errors, [['player command failed', { error: 'command failed' }]]);
  await manager.disconnect();
});

test('logs synchronous player command callback errors', async () => {
  const errors = [];
  const { manager } = createManager({
    onWhisper: () => { throw new Error('command failed synchronously'); },
    logger: { error: (...args) => errors.push(args) }
  });
  const bot = manager.connect();

  assert.doesNotThrow(() => bot.emit('whisper', 'Owner', '/play song'));
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(errors, [['player command failed', { error: 'command failed synchronously' }]]);
  await manager.disconnect();
});

test('rides the requested visible player with the main bot', async () => {
  const owner = { type: 'player', username: 'Owner', position: { x: 1, y: 2, z: 3 } };
  const { manager } = createManager({ sleep: async () => {} });
  const bot = manager.connect();
  const chats = [];
  const activations = [];
  bot.chat = (message) => chats.push(message);
  bot.clearControlStates = () => {};
  bot.nearestEntity = (predicate) => predicate(owner) ? owner : null;
  bot.activateEntityAt = async (entity, position) => activations.push([entity, position]);

  await manager.ride('Owner');

  assert.deepEqual(chats, ['/tp Owner']);
  assert.deepEqual(activations, [[owner, owner.position]]);
  await manager.disconnect();
});
