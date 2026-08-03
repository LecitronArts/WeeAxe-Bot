const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createBotManager } = require('../src/bot-manager');

function createFakeBot() {
  const bot = new EventEmitter();
  bot._client = { ended: false };
  bot.chat = () => {};
  bot.quitCalls = 0;
  bot.quit = () => { bot.quitCalls += 1; bot._client.ended = true; };
  return bot;
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
