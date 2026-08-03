const test = require('node:test');
const assert = require('node:assert/strict');

const { createCommandRouter } = require('../src/command-router');

test('routes search with the final comma-delimited page number', async () => {
  const calls = [];
  const router = createCommandRouter({
    search: async (query, page) => calls.push([query, page]),
    whisper: async () => {}
  });
  assert.equal(await router.handle('Player', '#search a,b,2'), true);
  assert.deepEqual(calls, [['a,b', 2]]);
});

test('does not route partial command prefixes', async () => {
  const router = createCommandRouter({ search: async () => assert.fail('called'), whisper: async () => {} });
  assert.equal(await router.handle('Player', '#searching song'), false);
});

test('enforces command policy and reports a disabled command', async () => {
  const messages = [];
  const router = createCommandRouter({
    stop: async () => assert.fail('called'),
    whisper: async (user, message) => messages.push([user, message]),
    commandPolicy: { allowPlay: true, allowStop: false, allowRide: true }
  });
  assert.equal(await router.handle('Player', '#stop'), true);
  assert.deepEqual(messages, [['Player', 'This command is disabled.']]);
});
