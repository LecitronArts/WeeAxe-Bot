const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const minecraftData = require('minecraft-data');

const { createApp, buildSearchReplyMessages, formatSearchResultHover, getSearchPageWindow } = require('../src/app');

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

test('keeps four nearby search pages visible at the end of the result set', () => {
  assert.deepEqual(getSearchPageWindow(9, 9), [6, 7, 8, 9]);
  assert.deepEqual(getSearchPageWindow(1, 9), [1, 2, 3, 4]);
});

test('formats the result tooltip with one song per item lore line', () => {
  assert.equal(
    formatSearchResultHover(['piano/one.nbs', 'piano/two.nbs']),
    '<hover:show_text:"<gray>1. <white>one</white><newline><gray>2. <white>two</white>">'
  );
});

test('builds a styled search result, numeric reply hint, and search-page commands', () => {
  const messages = buildSearchReplyMessages({
    username: 'Admin',
    mainBotName: 'PianoBot',
    query: 'piano',
    items: [
      'piano/classics/one.nbs',
      'piano/classics/two.nbs',
      'piano/classics/three.nbs',
      'piano/classics/four.nbs',
      'piano/classics/five.nbs'
    ],
    page: 2,
    totalPages: 3
  });

  assert.ok(messages.length >= 3);
  assert.ok(messages[0].includes('[搜索结果]'));
  assert.ok(messages[0].includes('1. one'));
  assert.ok(!messages[0].includes('piano/classics'));
  assert.ok(!messages[0].includes('回复bot数字播放相应歌曲'));
  assert.ok(messages[1].includes('回复bot数字播放相应歌曲'));
  assert.ok(!messages[1].includes('<click:'));
  assert.ok(!messages.some((message) => message.includes('"/tell PianoBot 1"')));
  const pagination = messages.slice(2).join('\n');
  assert.ok(pagination.includes('<click:run_command:"/tell PianoBot #search piano,1">‹</click>'));
  assert.ok(pagination.includes('<click:run_command:"/tell PianoBot #search piano,3">3</click>'));
  assert.ok(pagination.includes('<click:run_command:"/tell PianoBot #search piano,3">›</click>'));
  assert.ok(!pagination.includes('#page'));
  assert.ok(pagination.includes('2/3'));
  for (const message of messages) assert.ok(Buffer.byteLength(message) <= 256);
});

test('keeps compact replies within the chat command limit for long names and song titles', () => {
  const messages = buildSearchReplyMessages({
    username: 'SixteenCharName1',
    mainBotName: 'SixteenCharName2',
    query: 'piano',
    items: Array.from({ length: 5 }, () => `piano/${'很长的歌曲名字'.repeat(30)}.nbs`),
    page: 9,
    totalPages: 9
  });

  assert.ok(messages.length >= 3);
  for (const message of messages) assert.ok(Buffer.byteLength(message) <= 256);
});

test('uses the spare tooltip budget to keep long song titles readable', () => {
  const [resultMessage] = buildSearchReplyMessages({
    username: 'Admin',
    mainBotName: 'PianoBot',
    query: 'piano',
    items: [
      'piano/short.nbs',
      ...Array.from({ length: 4 }, () => `piano/${'很长的歌曲名字'.repeat(10)}.nbs`)
    ],
    page: 2,
    totalPages: 9
  });

  assert.ok(resultMessage.includes('1. short'));
  assert.ok(resultMessage.includes('2. 很长的歌曲名字很长'));
  assert.ok(Buffer.byteLength(resultMessage) <= 256);
});

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

test('routes an owner whisper to a held song-list item and one pagination message', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const configPath = path.join(directory, 'config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(validConfig()));
  let onWhisper;
  const searchCalls = [];
  const sleeps = [];
  const selectedSongs = [];
  const inventory = new EventEmitter();
  inventory.slots = [];
  const bot = {
    whispers: [],
    chats: [],
    whisper(username, message) { this.whispers.push([username, message]); },
    chat(message) { this.chats.push(message); },
    registry: minecraftData('1.21.10'),
    quickBarSlot: 0,
    inventory,
    creativeWrites: [],
    _client: {
      write: (name, params) => {
        bot.creativeWrites.push({ name, params });
        if (params.item?.name === 'paper') {
          queueMicrotask(() => {
            const confirmedItem = { name: 'paper', type: params.item.itemId, count: params.item.itemCount };
            inventory.slots[params.slot] = confirmedItem;
            inventory.emit(`updateSlot:${params.slot}`, null, confirmedItem);
          });
        }
      }
    }
  };
  const app = await createApp({
    configPath,
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async (relativePath) => { selectedSongs.push(relativePath); return 'song.nbs'; },
        search: async (query, page, pageSize) => {
          searchCalls.push({ query, page, pageSize });
          return {
            items: [
              'piano/classics/one.nbs',
              'piano/classics/two.nbs',
              'piano/classics/three.nbs',
              'piano/classics/four.nbs',
              'piano/classics/five.nbs'
            ],
            page: 2,
            totalPages: 3,
            total: 21
          };
        }
      }),
      createBotManager: (options) => {
        onWhisper = options.onWhisper;
        return {
          disconnect: async () => {},
          getPlaybackBots: async () => [],
          releaseChildBots: async () => {},
          ride: async () => {}
        };
      },
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null,
      readFile: async () => Buffer.from('song'),
      sleep: async (milliseconds) => sleeps.push(milliseconds)
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  assert.equal(typeof onWhisper, 'function');
  await onWhisper({ bot, username: 'Admin', message: '#search piano,2' });

  assert.deepEqual(searchCalls, [{ query: 'piano', page: 2, pageSize: 8 }]);
  assert.ok(bot.chats.length >= 2);
  const listMessage = bot.chats[0];
  const paginationMessage = bot.chats.slice(1).join('\n');
  assert.equal(listMessage, '/tell Admin <item:p:i>');
  assert.equal(bot.creativeWrites.length, 1);
  assert.equal(bot.creativeWrites[0].name, 'set_creative_slot');
  assert.equal(bot.creativeWrites[0].params.slot, 36);
  assert.equal(bot.creativeWrites[0].params.item.components[1].type, 'lore');
  assert.ok(Buffer.isBuffer(bot.creativeWrites[0].params.item.components[1].data));
  assert.match(paginationMessage, /<click:run_command:"\/tell PianoBot #search piano,1">‹<\/click>/);
  assert.match(paginationMessage, /<click:run_command:"\/tell PianoBot #search piano,3">3<\/click>/);
  assert.match(paginationMessage, /<click:run_command:"\/tell PianoBot #search piano,3">›<\/click>/);
  assert.ok(paginationMessage.includes('2/3'));
  for (const message of bot.chats) assert.ok(Buffer.byteLength(message) <= 256);
  assert.equal(sleeps.at(-1), 10000);
  assert.ok(sleeps.slice(0, -1).every((milliseconds) => milliseconds === 150));

  await onWhisper({ bot, username: 'Admin', message: '3' });
  await new Promise(setImmediate);

  assert.deepEqual(selectedSongs, ['piano/classics/three.nbs']);
  assert.deepEqual(bot.whispers.at(-1), ['Admin', 'Playback started.']);

  await onWhisper({ bot, username: 'Admin', message: '#search piano,3' });

  assert.deepEqual(searchCalls, [
    { query: 'piano', page: 2, pageSize: 8 },
    { query: 'piano', page: 3, pageSize: 8 }
  ]);
  assert.ok(bot.chats.length >= 4);
  assert.equal(bot.creativeWrites.length, 3);
});

test('reports an error without a text song list when the song-list item cannot be written', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const configPath = path.join(directory, 'config.json');
  await fs.promises.writeFile(configPath, JSON.stringify(validConfig()));
  let onWhisper;
  const bot = {
    chats: [],
    whispers: [],
    chat(message) { this.chats.push(message); },
    whisper(username, message) { this.whispers.push([username, message]); }
  };
  const app = await createApp({
    configPath,
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async () => 'song.nbs',
        search: async () => ({
          items: ['piano/one.nbs'],
          page: 1,
          totalPages: 2,
          total: 2
        })
      }),
      createBotManager: (options) => {
        onWhisper = options.onWhisper;
        return {
          disconnect: async () => {},
          getPlaybackBots: async () => [],
          releaseChildBots: async () => {},
          connect: () => {}
        };
      },
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null,
      sleep: async () => {}
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await onWhisper({ bot, username: 'Admin', message: '#search piano' });

  assert.deepEqual(bot.chats, ['/tell Admin <red>歌单物品生成失败，请重新搜索。</red>']);
  await control.requestForTest({ id: 'status', command: 'getSettings' });
});

test('keeps Flutter library searches at ten songs per page', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  const searchCalls = [];
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async () => 'song.nbs',
        search: async (query, page, pageSize) => {
          searchCalls.push({ query, page, pageSize });
          return { items: [], page: 1, totalPages: 1, total: 0 };
        }
      }),
      createBotManager: () => ({ disconnect: async () => {}, getPlaybackBots: async () => [], releaseChildBots: async () => {} }),
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await control.requestForTest({ id: 'flutter-search', command: 'searchSongs', payload: { query: 'piano', page: 3 } });

  assert.deepEqual(searchCalls, [{ query: 'piano', page: 3, pageSize: 10 }]);
});

test('routes play, stop, and ride whispers through the active runtime', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let onWhisper;
  const played = [];
  const stopped = [];
  const ridden = [];
  const bot = {
    whispers: [],
    whisper(username, message) { this.whispers.push([username, message]); }
  };
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async (relativePath) => relativePath,
        search: async () => ({ items: [], page: 1, totalPages: 1, total: 0 })
      }),
      createBotManager: (options) => {
        onWhisper = options.onWhisper;
        return {
          disconnect: async () => {},
          getPlaybackBots: async () => [],
          releaseChildBots: async () => {},
          ride: async (username) => ridden.push(username)
        };
      },
      createPlaybackController: () => ({
        play: async (song) => played.push(song.toString()),
        stop: async () => stopped.push('stop')
      }),
      loadKeymap: () => () => null,
      readFile: async (relativePath) => Buffer.from(relativePath)
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await onWhisper({ bot, username: 'Admin', message: '#play songs/demo.nbs' });
  await new Promise(setImmediate);
  await onWhisper({ bot, username: 'Admin', message: '#stop' });
  await onWhisper({ bot, username: 'Admin', message: '#ride' });

  assert.deepEqual(played, ['songs/demo.nbs']);
  assert.deepEqual(stopped, ['stop', 'stop']);
  assert.deepEqual(ridden, ['Admin']);
  assert.deepEqual(bot.whispers, [
    ['Admin', 'Playback started.'],
    ['Admin', 'Playback stopped.'],
    ['Admin', 'Ride requested.']
  ]);
});

test('does not disclose playback failure details to the player', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let onWhisper;
  const bot = {
    whispers: [],
    whisper(username, message) { this.whispers.push([username, message]); }
  };
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({
        resolveSong: async () => { throw new Error('D:/private/songs/missing.nbs'); },
        search: async () => ({ items: [], page: 1, totalPages: 1, total: 0 })
      }),
      createBotManager: (options) => {
        onWhisper = options.onWhisper;
        return { disconnect: async () => {}, getPlaybackBots: async () => [], releaseChildBots: async () => {}, ride: async () => {} };
      },
      createPlaybackController: () => ({ play: async () => assert.fail('must not play'), stop: async () => {} }),
      loadKeymap: () => () => null
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await onWhisper({ bot, username: 'Admin', message: '#play missing.nbs' });
  await new Promise(setImmediate);

  assert.deepEqual(bot.whispers, [
    ['Admin', 'Playback started.'],
    ['Admin', 'Unable to start playback.']
  ]);
});

test('replies with a generic message when a player command fails synchronously', async (t) => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-app-'));
  let onWhisper;
  const bot = {
    whispers: [],
    whisper(username, message) { this.whispers.push([username, message]); }
  };
  const app = await createApp({
    configPath: path.join(directory, 'config.json'),
    dependencies: {
      createSongLibrary: () => ({ search: async () => ({ items: [], page: 1, totalPages: 1, total: 0 }), resolveSong: async () => 'song.nbs' }),
      createBotManager: (options) => {
        onWhisper = options.onWhisper;
        return {
          disconnect: async () => {},
          getPlaybackBots: async () => [],
          releaseChildBots: async () => {},
          ride: async () => { throw new Error('server command permission denied'); }
        };
      },
      createPlaybackController: () => ({ play: async () => {}, stop: async () => {} }),
      loadKeymap: () => () => null
    }
  });
  const control = await app.start();
  t.after(async () => {
    await app.shutdown();
    await fs.promises.rm(directory, { recursive: true, force: true });
  });

  await onWhisper({ bot, username: 'Admin', message: '#ride' });

  assert.deepEqual(bot.whispers, [['Admin', 'Unable to complete command.']]);
});
