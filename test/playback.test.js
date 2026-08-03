const test = require('node:test');
const assert = require('node:assert/strict');

const { createPlaybackController } = require('../src/playback');
const { sendTabComplete } = require('../src/protocol-adapter');

test('cancels before sending the next tick', async () => {
  let release;
  const sent = [];
  const player = createPlaybackController({
    decode: () => ({ name: 'unit', timePerTick: 1, ticks: [[{ instrument: 0, key: 0 }], [{ instrument: 0, key: 1 }]] }),
    toPacketText: () => '/// A',
    sleep: () => new Promise((resolve) => { release = resolve; }),
    send: async (_bot, _transactionId, text) => sent.push(text),
    getBots: async () => [{}]
  });

  const playing = player.play(Buffer.from('nbs'));
  await new Promise(setImmediate);
  player.stop();
  release();
  await playing;

  assert.deepEqual(sent, ['/// A']);
  assert.equal(player.isPlaying(), false);
});

test('increments transaction ids for each sent note and emits progress', async () => {
  const sent = [];
  const progress = [];
  const player = createPlaybackController({
    decode: () => ({ name: 'unit', timePerTick: 0, ticks: [[{ instrument: 0, key: 0 }, { instrument: 0, key: 1 }]] }),
    toPacketText: (_instrument, key) => `/// ${key}`,
    sleep: async () => {},
    send: async (_bot, transactionId, text) => sent.push([transactionId, text]),
    getBots: async () => [{}, {}],
    onProgress: (event) => progress.push(event)
  });

  await player.play(Buffer.from('nbs'));
  assert.deepEqual(sent, [[1, '/// 0'], [2, '/// 1']]);
  assert.deepEqual(progress.at(-1), { songName: 'unit', tick: 1, totalTicks: 1, botCount: 2, playing: false });
});

test('writes tab_complete only for a live protocol client', () => {
  const writes = [];
  sendTabComplete({ _client: { ended: false, write: (...args) => writes.push(args) } }, 7, '/// A');
  assert.deepEqual(writes, [['tab_complete', { transactionId: 7, text: '/// A' }]]);
  assert.throws(() => sendTabComplete({ _client: { ended: true } }, 1, 'x'), /unavailable/);
});
