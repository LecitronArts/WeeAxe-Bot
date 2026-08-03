const fs = require('node:fs/promises');
const { loadConfig, saveConfig, validateConfig } = require('./config');
const { createLogger } = require('./logger');
const { createSongLibrary } = require('./song-library');
const { createBotManager } = require('./bot-manager');
const { createPlaybackController } = require('./playback');
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
  function buildRuntime(runtimeConfig) {
    const runtimeLibrary = buildSongLibrary(runtimeConfig.songRepository);
    const runtimeBotManager = buildBotManager({ mineflayer, config: runtimeConfig, logger, onStatus: (status) => publish({ type: 'connectionStatus', ...status }) });
    const runtimePlayback = buildPlaybackController({
      toPacketText: loadKeymapFile(keymapPath), send: sendPacket,
      getBots: () => runtimeBotManager.getPlaybackBots(1), releaseBots: () => runtimeBotManager.releaseChildBots(),
      onProgress: (status) => publish({ type: 'playbackStatus', ...status })
    });
    return { library: runtimeLibrary, botManager: runtimeBotManager, playback: runtimePlayback };
  }
  function replaceRuntime(runtimeConfig) {
    const runtime = buildRuntime(runtimeConfig);
    config = runtimeConfig;
    library = runtime.library;
    botManager = runtime.botManager;
    playback = runtime.playback;
  }
  function invalidatePlayback() {
    playbackGeneration += 1;
    return playbackGeneration;
  }
  async function stopCurrentPlayback() {
    invalidatePlayback();
    await playback.stop();
  }
  let library;
  replaceRuntime(config);
  control = createControlServer({ port, handlers: {
    connect: async () => { config = validateConfig(config); botManager.connect(); return { state: 'connecting' }; },
    disconnect: async () => { await stopCurrentPlayback(); await botManager.disconnect(); return { state: 'disconnected' }; },
    searchSongs: async ({ query = '', page = 1 }) => library.search(query, page, 10),
    playSong: async ({ relativePath }) => {
      const currentLibrary = library;
      const currentPlayback = playback;
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
      });
      return { state: 'started' };
    },
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
