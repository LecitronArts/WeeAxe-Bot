const test = require('node:test');
const assert = require('node:assert/strict');
const WebSocket = require('ws');
const { createControlServer } = require('../src/control-server');

test('acknowledges a local command with the same request id', async () => {
  const server = await createControlServer({ port: 0, handlers: { connect: async () => ({ state: 'connecting' }) } }).start();
  const socket = new WebSocket(`ws://127.0.0.1:${server.port}`);
  const response = await new Promise((resolve) => {
    socket.on('open', () => socket.send(JSON.stringify({ id: 'r1', command: 'connect', payload: {} })));
    socket.on('message', (data) => resolve(JSON.parse(data)));
  });
  assert.deepEqual(response, { type: 'response', id: 'r1', ok: true, payload: { state: 'connecting' } });
  socket.close(); await server.stop();
});

test('rejects unsupported commands', async () => {
  const server = await createControlServer({ port: 0, handlers: {} }).start();
  const response = await server.requestForTest({ id: 'r2', command: 'deleteEverything', payload: {} });
  assert.equal(response.error.code, 'UNSUPPORTED_COMMAND');
  await server.stop();
});
