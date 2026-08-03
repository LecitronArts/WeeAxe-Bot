const fs = require('node:fs/promises');
const { loadConfig, saveConfig, validateConfig } = require('./config');
const { createLogger } = require('./logger');
const { createSongLibrary } = require('./song-library');
const { createBotManager } = require('./bot-manager');
const { createPlaybackController } = require('./playback');
const { createCommandRouter } = require('./command-router');
const { sendTabComplete } = require('./protocol-adapter');
const { loadKeymap } = require('./keymap');
const { createControlServer } = require('./control-server');

async function createApp({ configPath, port = 0, mineflayer = require('mineflayer'), keymapPath = '键位文件.txt', dependencies = {} }) {
  const {
    createSongLibrary: buildSongLibrary = createSongLibrary,
    createBotManager: buildBotManager = createBotManager,
    createPlaybackController: buildPlaybackController = createPlaybackController,
    loadKeymap: loadKeymapFile = loadKeymap,
    sendTabComplete: sendPacket = sendTabComplete,
    readFile = fs.readFile,
    saveConfig: persistConfig = saveConfig
  } = dependencies;
  let config = await loadConfig(configPath);
  let control;
  const publish = (event) => control?.publish(event);
  const logger = createLogger(publish);
  let botManager;
  let playback;
  let playbackGeneration = 0;
  function invalidatePlayback() {
    playbackGeneration += 1;
    return playbackGeneration;
  }
  async function startPlayback(runtime, relativePath, { onError } = {}) {
    const currentLibrary = runtime.library;
    const currentPlayback = runtime.playback;
    const generation = invalidatePlayback();
    void Promise.resolve().then(async () => {
      await currentPlayback.stop();
      if (generation !== playbackGeneration) return;
      const songPath = await currentLibrary.resolveSong(relativePath);
      if (generation !== playbackGeneration) return;
      const song = await readFile(songPath);
      if (generation !== playbackGeneration) return;
      await currentPlayback.play(song);
    }).catch((error) => {
      if (generation !== playbackGeneration) return;
      logger.error('playback failed', { relativePath, error: error.message });
      publish({ type: 'error', code: 'PLAYBACK_FAILED', message: error.message });
      void Promise.resolve().then(() => onError?.()).catch((replyError) => {
        logger.error('player command reply failed', { error: replyError.message });
      });
    });
    return { state: 'started' };
  }
  async function stopPlayback(currentPlayback) {
    invalidatePlayback();
    await currentPlayback.stop();
  }
  function buildRuntime(runtimeConfig) {
    const runtimeLibrary = buildSongLibrary(runtimeConfig.songRepository);
    let runtimeBotManager;
    const runtimePlayback = buildPlaybackController({
      toPacketText: loadKeymapFile(keymapPath), send: sendPacket,
      getBots: () => runtimeBotManager.getPlaybackBots(1), releaseBots: () => runtimeBotManager.releaseChildBots(),
      onProgress: (status) => publish({ type: 'playbackStatus', ...status })
    });
    const reply = async (context, username, message) => {
      const bot = context?.bot;
      if (!bot || typeof bot.whisper !== 'function') throw new Error('command source bot cannot reply');
      await bot.whisper(username, message);
    };
    const runtime = { library: runtimeLibrary, botManager: undefined, playback: runtimePlayback };
    const commandRouter = createCommandRouter({
      commandPolicy: runtimeConfig.commandPolicy,
      search: async (query, page, username, _mainBotName, context) => {
        const result = await runtimeLibrary.search(query, page, 10);
        await reply(context, username, `Songs ${result.page}/${result.totalPages} (${result.total} total):`);
        for (const relativePath of result.items) {
          await reply(context, username, `${relativePath} | #play ${relativePath}`);
        }
      },
      play: async (relativePath, username, context) => {
        await startPlayback(runtime, relativePath, {
          onError: () => reply(context, username, 'Unable to start playback.')
        });
        await reply(context, username, 'Playback started.');
      },
      stop: async (username, context) => {
        await stopPlayback(runtimePlayback);
        await reply(context, username, 'Playback stopped.');
      },
      ride: async (username, context) => {
        await runtimeBotManager.ride(username);
        await reply(context, username, 'Ride requested.');
      },
      whisper: async (username, message, context) => reply(context, username, message)
    });
    runtimeBotManager = buildBotManager({
      mineflayer,
      config: runtimeConfig,
      logger,
      onStatus: (status) => publish({ type: 'connectionStatus', ...status }),
      onWhisper: ({ bot, username, message }) => commandRouter.handle(username, message, { bot })
    });
    runtime.botManager = runtimeBotManager;
    return { library: runtimeLibrary, botManager: runtimeBotManager, playback: runtimePlayback };
  }
  function replaceRuntime(runtimeConfig) {
    const runtime = buildRuntime(runtimeConfig);
    config = runtimeConfig;
    library = runtime.library;
    botManager = runtime.botManager;
    playback = runtime.playback;
  }
  async function stopCurrentPlayback() {
    await stopPlayback(playback);
  }
  let library;
  replaceRuntime(config);
  control = createControlServer({ port, handlers: {
    connect: async () => { config = validateConfig(config); botManager.connect(); return { state: 'connecting' }; },
    disconnect: async () => { await stopCurrentPlayback(); await botManager.disconnect(); return { state: 'disconnected' }; },
    searchSongs: async ({ query = '', page = 1 }) => library.search(query, page, 10),
    playSong: async ({ relativePath }) => startPlayback({ library, playback }, relativePath),
    stopPlayback: async () => { await stopCurrentPlayback(); return { state: 'stopped' }; },
    getSettings: async () => config,
    saveSettings: async (next) => {
      const nextConfig = validateConfig(next);
      await persistConfig(configPath, nextConfig);
      const oldPlayback = playback;
      const oldBotManager = botManager;
      invalidatePlayback();
      await oldPlayback.stop();
      await oldBotManager.disconnect();
      replaceRuntime(nextConfig);
      return config;
    },
    shutdown: async () => { await stopCurrentPlayback(); await botManager.disconnect(); return { state: 'stopped' }; }
  } });
  return { async start() { const started = await control.start(); return started; }, async shutdown() { await stopCurrentPlayback(); await botManager.disconnect(); await control.stop(); } };
}
module.exports = { createApp };
