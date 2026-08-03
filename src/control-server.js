const { WebSocketServer } = require('ws');

const COMMANDS = new Set(['connect', 'disconnect', 'searchSongs', 'playSong', 'stopPlayback', 'getSettings', 'saveSettings', 'shutdown']);

function createControlServer({ port, handlers }) {
  let server;
  function response(request, ok, payload) {
    return ok
      ? { type: 'response', id: request.id, ok: true, payload }
      : { type: 'response', id: request.id, ok: false, error: payload };
  }
  async function handle(request) {
    if (!request || typeof request.id !== 'string' || !request.id || typeof request.command !== 'string') {
      return { type: 'response', id: request?.id ?? null, ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid request' } };
    }
    if (!COMMANDS.has(request.command) || typeof handlers[request.command] !== 'function') {
      return response(request, false, { code: 'UNSUPPORTED_COMMAND', message: 'Unsupported command' });
    }
    try { return response(request, true, await handlers[request.command](request.payload ?? {})); }
    catch (error) { return response(request, false, { code: 'COMMAND_FAILED', message: error.message }); }
  }
  return {
    async start() {
      server = new WebSocketServer({ host: '127.0.0.1', port });
      await new Promise((resolve) => server.once('listening', resolve));
      server.on('connection', (socket) => socket.on('message', async (raw) => {
        let request;
        try { request = JSON.parse(raw); } catch { socket.send(JSON.stringify({ type: 'response', id: null, ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON' } })); return; }
        socket.send(JSON.stringify(await handle(request)));
      }));
      return { port: server.address().port, stop: () => this.stop(), requestForTest: this.requestForTest, publish: this.publish };
    },
    async stop() { if (server) await new Promise((resolve) => server.close(resolve)); },
    requestForTest: handle,
    publish(event) { for (const socket of server?.clients ?? []) if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event)); }
  };
}
module.exports = { createControlServer };
