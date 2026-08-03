const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createApp } = require('../src/app');

function validConfig(overrides = {}) {
  return {
    serverHost: '127.0.0.1',
    serverPort: 25565,
    mainBotName: 'PianoBot',
    botOwner: 'Admin',
    loginPassword: '',
    songRepository: 'C:/songs',
    reconnectDelayMs: 5000,
    commandPolicy: { allowPlay: true, allowStop: true, allowRide: true },
    ...overrides
  };
}

test('playSong returns started before background playback completes', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const configPath = path.join(directory, 'config.json');
  let releasePlayback;
  let playbackStarted = false;
  const playbackFinished = new Promise((resolve) => { releasePlayback = resolve; });
  const app = await createApp({
    configPath,
    dependencies: {
      createSongLibrary: () => ({ resolveSong: async () => 'song.nbs', search: async () => ({}) }),
      createBotManager: () => ({
        connect() {},
        disconnect: async () => {},
        getPlaybackBots: async () => [],
        releaseChildBots: async () => {}
      }),
      createPlaybackController: () => ({
        play: async () => { playbackStarted = true; await playbackFinished; },
        stop: async () => { releasePlayback(); }
      }),
      loadKeymap: () => () => null,
      readFile: async () => Buffer.from('nbs')
    }
  });
  const control = await app.start();
  t.after(async () => {
    releasePlayback();
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  let response;
  const request = control.requestForTest({
    id: 'play-1', command: 'playSong', payload: { relativePath: 'song.nbs' }
  }).then((value) => { response = value; });
  await new Promise(setImmediate);

  assert.equal(playbackStarted, true);
  assert.deepEqual(response, {
    type: 'response', id: 'play-1', ok: true, payload: { state: 'started' }
  });

  releasePlayback();
  await request;
});

test('playSong returns started before slow song resolution completes', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const configPath = path.join(directory, 'config.json');
  let releaseResolution;
  let resolutionStarted = false;
  const resolutionFinished = new Promise((resolve) => { releaseResolution = resolve; });
  const app = await createApp({
    configPath,
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async () => {
          resolutionStarted = true;
          await resolutionFinished;
          return 'song.nbs';
        },
        search: async () => ({})
      }),
      createBotManager: () => ({
        connect() {},
        disconnect: async () => {},
        getPlaybackBots: async () => [],
        releaseChildBots: async () => {}
      }),
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null,
      readFile: async () => Buffer.from('nbs')
    }
  });
  const control = await app.start();
  t.after(async () => {
    releaseResolution();
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  let response;
  const request = control.requestForTest({
    id: 'play-2', command: 'playSong', payload: { relativePath: 'song.nbs' }
  }).then((value) => { response = value; });
  await new Promise(setImmediate);

  assert.equal(resolutionStarted, true);
  assert.deepEqual(response, {
    type: 'response', id: 'play-2', ok: true, payload: { state: 'started' }
  });

  releaseResolution();
  await request;
});

test('stopPlayback prevents a slow play request from starting after resolution', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let releaseResolution;
  const resolutionFinished = new Promise((resolve) => { releaseResolution = resolve; });
  const played = [];
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async () => { await resolutionFinished; return 'old.nbs'; },
        search: async () => ({})
      }),
      createBotManager: () => ({ disconnect: async () => {}, getPlaybackBots: async () => [], releaseChildBots: async () => {} }),
      createPlaybackController: () => ({ play: async (file) => played.push(file.toString()), stop: async () => {} }),
      loadKeymap: () => () => null,
      readFile: async (songPath) => Buffer.from(songPath)
    }
  });
  const control = await app.start();
  t.after(async () => {
    releaseResolution();
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await control.requestForTest({ id: 'stop-old', command: 'playSong', payload: { relativePath: 'old.nbs' } });
  await new Promise(setImmediate);
  await control.requestForTest({ id: 'stop', command: 'stopPlayback', payload: {} });
  releaseResolution();
  await new Promise(setImmediate);

  assert.deepEqual(played, []);
});

test('a newer play request prevents an older slow request from playing', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let releaseOld;
  const oldResolved = new Promise((resolve) => { releaseOld = resolve; });
  const played = [];
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async (song) => {
          if (song === 'old.nbs') await oldResolved;
          return song;
        },
        search: async () => ({})
      }),
      createBotManager: () => ({ disconnect: async () => {}, getPlaybackBots: async () => [], releaseChildBots: async () => {} }),
      createPlaybackController: () => ({ play: async (file) => played.push(file.toString()), stop: async () => {} }),
      loadKeymap: () => () => null,
      readFile: async (songPath) => Buffer.from(songPath)
    }
  });
  const control = await app.start();
  t.after(async () => {
    releaseOld();
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await control.requestForTest({ id: 'old', command: 'playSong', payload: { relativePath: 'old.nbs' } });
  await new Promise(setImmediate);
  await control.requestForTest({ id: 'new', command: 'playSong', payload: { relativePath: 'new.nbs' } });
  releaseOld();
  await new Promise(setImmediate);

  assert.deepEqual(played, ['new.nbs']);
});

test('saveSettings stops and disconnects the old runtime before rebuilding', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const events = [];
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: (repository) => { events.push(`library:${repository}`); return { search: async () => ({ repository }), resolveSong: async () => 'song.nbs' }; },
      createBotManager: ({ config }) => ({
        disconnect: async () => events.push(`disconnect:${config.serverHost}`),
        getPlaybackBots: async () => [], releaseChildBots: async () => {}
      }),
      createPlaybackController: () => ({ play: async () => {}, stop: async () => events.push('stop') }),
      loadKeymap: () => () => null
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });
  events.length = 0;

  const response = await control.requestForTest({ id: 'save', command: 'saveSettings', payload: validConfig() });

  assert.equal(response.ok, true);
  assert.deepEqual([...events], [
    'stop',
    'disconnect:',
    'library:C:/songs'
  ]);
});

test('a failed saveSettings keeps the existing in-memory runtime instances', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let libraryCount = 0;
  let managerCount = 0;
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => {
        libraryCount += 1;
        return { search: async () => ({ libraryCount }), resolveSong: async () => 'song.nbs' };
      },
      createBotManager: () => {
        managerCount += 1;
        return { disconnect: async () => {}, getPlaybackBots: async () => [], releaseChildBots: async () => {} };
      },
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null,
      saveConfig: async () => { throw new Error('disk full'); }
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  const response = await control.requestForTest({ id: 'save-fail', command: 'saveSettings', payload: validConfig() });
  const settings = await control.requestForTest({ id: 'settings', command: 'getSettings', payload: {} });
  const search = await control.requestForTest({ id: 'search', command: 'searchSongs', payload: {} });

  assert.equal(response.ok, false);
  assert.equal(settings.payload.serverHost, '');
  assert.equal(search.payload.libraryCount, 1);
  assert.equal(managerCount, 1);
});

test('a failed saveSettings leaves the running bot and playback untouched', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let stops = 0;
  let disconnects = 0;
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({ search: async () => ({}), resolveSong: async () => 'song.nbs' }),
      createBotManager: () => ({
        disconnect: async () => { disconnects += 1; },
        getPlaybackBots: async () => [],
        releaseChildBots: async () => {}
      }),
      createPlaybackController: () => ({ play: async () => {}, stop: async () => { stops += 1; } }),
      loadKeymap: () => () => null,
      saveConfig: async () => { throw new Error('disk full'); }
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  const response = await control.requestForTest({ id: 'save-running-fail', command: 'saveSettings', payload: validConfig() });

  assert.equal(response.ok, false);
  assert.equal(stops, 0);
  assert.equal(disconnects, 0);
});
