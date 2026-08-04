const fs = require('node:fs/promises');
const path = require('node:path');
const { loadConfig, saveConfig, validateConfig } = require('./config');
const { createLogger } = require('./logger');
const { createSongLibrary } = require('./song-library');
const { createBotManager } = require('./bot-manager');
const { createPlaybackController } = require('./playback');
const { createCommandRouter } = require('./command-router');
const { createPrivateReplyScheduler } = require('./private-reply-scheduler');
const { createSearchSelection } = require('./search-selection');
const { setSongListInHand } = require('./song-list-item');
const { sendTabComplete } = require('./protocol-adapter');
const { loadKeymap } = require('./keymap');
const { createControlServer } = require('./control-server');

function escapeMiniMessageText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/</g, '\\<');
}

function escapeMiniMessageArgument(value) {
  return escapeMiniMessageText(value).replace(/"/g, '\\"');
}

function formatSearchResultHover(items) {
  const lines = items.map((relativePath, index) => {
    const songName = escapeMiniMessageArgument(getSearchSongTitle(relativePath));
    return `<gray>${index + 1}. <white>${songName}</white>`;
  });
  return `<hover:show_text:"${lines.join('<newline>')}">`;
}

function getSearchPageWindow(page, totalPages) {
  const total = Math.max(0, Math.trunc(Number(totalPages) || 0));
  if (total === 0) return [];

  const current = Math.min(total, Math.max(1, Math.trunc(Number(page) || 1)));
  const visibleCount = Math.min(4, total);
  const start = Math.min(Math.max(1, current - 1), total - visibleCount + 1);
  return Array.from({ length: visibleCount }, (_unused, index) => start + index);
}

function getSearchSongTitle(relativePath) {
  return path.posix.basename(String(relativePath)).replace(/\.nbs$/i, '');
}

const MAX_CHAT_COMMAND_BYTES = 256;

function truncateMiniMessageText(value, maximumBytes) {
  const text = String(value);
  const full = escapeMiniMessageArgument(text);
  if (Buffer.byteLength(full) <= maximumBytes) return full;

  let result = '';
  for (const character of text) {
    const candidate = escapeMiniMessageArgument(result + character);
    if (Buffer.byteLength(candidate + '...') > maximumBytes) break;
    result += character;
  }
  return result ? escapeMiniMessageArgument(result) + '...' : '';
}

function formatCompactSearchResultList(items, maximumBytes) {
  const names = (items.length > 0 ? items : ['No results']).map(getSearchSongTitle);
  const truncated = names.map(() => false);
  const render = () => '<hover:show_text:"' + names.map((name, index) => {
    const suffix = truncated[index] ? '...' : '';
    return (index + 1) + '. ' + escapeMiniMessageArgument(name) + suffix;
  }).join('<newline>') + '">&b&l[搜索结果]</hover>';

  while (Buffer.byteLength(render()) > maximumBytes) {
    let longestIndex = -1;
    let longestBytes = -1;
    for (const [index, name] of names.entries()) {
      if (name.length === 0) continue;
      const bytes = Buffer.byteLength(escapeMiniMessageArgument(name));
      if (bytes > longestBytes) {
        longestIndex = index;
        longestBytes = bytes;
      }
    }
    if (longestIndex < 0) break;
    names[longestIndex] = Array.from(names[longestIndex]).slice(0, -1).join('');
    truncated[longestIndex] = true;
  }

  return render();
}

function compactButton(command, content) {
  return '<click:run_command:"' + escapeMiniMessageArgument(command) + '">' + content + '</click>';
}

function packSearchMessages(username, contents) {
  const prefix = '/tell ' + username + ' ';
  const messages = [];
  let current = '';
  for (const content of contents) {
    const candidate = current + content;
    if (Buffer.byteLength(prefix + candidate) <= MAX_CHAT_COMMAND_BYTES) {
      current = candidate;
      continue;
    }
    if (current) messages.push(prefix + current);
    if (Buffer.byteLength(prefix + content) > MAX_CHAT_COMMAND_BYTES) {
      throw new Error('search menu control exceeds the chat command limit');
    }
    current = content;
  }
  if (current) messages.push(prefix + current);
  return messages;
}

function buildSearchReplyMessages({ username, mainBotName, query, items, page, totalPages }) {
  const prefix = '/tell ' + username + ' ';
  const list = formatCompactSearchResultList(items, MAX_CHAT_COMMAND_BYTES - Buffer.byteLength(prefix));
  const hint = '<gray>回复bot数字播放相应歌曲</gray>';
  const pages = getSearchPageWindow(page, totalPages);
  const navigation = [];
  const pageCommand = (targetPage) => {
    return '/tell ' + mainBotName + ' #search ' + query + ',' + targetPage;
  };
  if (page > 1) navigation.push(compactButton(pageCommand(page - 1), '‹'));
  for (const targetPage of pages) {
    navigation.push(targetPage === page
      ? '&e[' + targetPage + ']'
      : compactButton(pageCommand(targetPage), String(targetPage)));
  }
  if (page < totalPages) navigation.push(compactButton(pageCommand(page + 1), '›'));
  navigation.push(page + '/' + totalPages);
  const paginationMessages = packSearchMessages(username, navigation.map((entry, index) => index === 0 ? entry : ' ' + entry));

  return [
    prefix + list,
    prefix + hint,
    ...paginationMessages
  ];
}

async function createApp({ configPath, port = 0, mineflayer = require('mineflayer'), keymapPath = 'keymap.txt', dependencies = {} }) {
  const {
    createSongLibrary: buildSongLibrary = createSongLibrary,
    createBotManager: buildBotManager = createBotManager,
    createPlaybackController: buildPlaybackController = createPlaybackController,
    createPrivateReplyScheduler: buildPrivateReplyScheduler = createPrivateReplyScheduler,
    loadKeymap: loadKeymapFile = loadKeymap,
    sendTabComplete: sendPacket = sendTabComplete,
    readFile = fs.readFile,
    saveConfig: persistConfig = saveConfig,
    sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  } = dependencies;
  let config = await loadConfig(configPath);
  let control;
  const publish = (event) => control?.publish(event);
  const logger = createLogger(publish);
  const privateReplyScheduler = buildPrivateReplyScheduler({ sleep });
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
    const searchSelection = createSearchSelection();
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
    const replySearchMenu = async (context, username, message) => {
      const bot = context?.bot;
      if (!bot || typeof bot.chat !== 'function') throw new Error('command source bot cannot send a search menu');
      await bot.chat(message);
    };
    async function replySearchPage(query, page, username, mainBotName, context, schedulerOptions) {
      const scheduled = privateReplyScheduler.schedule(username, async () => {
        const result = await runtimeLibrary.search(query, page, 8);
        searchSelection.save(username, result.items, {
          query,
          page: result.page,
          totalPages: result.totalPages
        });
        const messages = buildSearchReplyMessages({
          username,
          mainBotName,
          query,
          items: result.items,
          page: result.page,
          totalPages: result.totalPages
        });
        try {
          await setSongListInHand(context?.bot, result.items, result.page, result.totalPages, {
            beforeWrite: (packet) => logger.debug('writing creative song-list packet', packet)
          });
          messages.splice(0, 2, '/tell ' + username + ' <item:p:i>');
        } catch (error) {
          logger.warn('song list item could not be written', { error: error.message });
          messages.splice(0, messages.length, '/tell ' + username + ' <red>歌单物品生成失败，请重新搜索。</red>');
        }
        for (const [index, message] of messages.entries()) {
          await replySearchMenu(context, username, message);
          if (index < messages.length - 1) await sleep(150);
        }
      }, schedulerOptions);
      if (scheduled.dropped) {
        await reply(context, username, 'Search already in progress.');
        return;
      }
      await scheduled;
    }
    const runtime = { library: runtimeLibrary, botManager: undefined, playback: runtimePlayback };
    const commandRouter = createCommandRouter({
      commandPolicy: runtimeConfig.commandPolicy,
      mainBotName: runtimeConfig.mainBotName,
      search: (query, page, username, mainBotName, context) => replySearchPage(query, page, username, mainBotName, context, {
        continueAfterOwnCooldown: searchSelection.isActivePage(username, query, page)
      }),
      pick: async (choice, username, context) => {
        const relativePath = searchSelection.get(username, choice);
        if (!relativePath) {
          await reply(context, username, 'Search selection expired. Run #search again.');
          return;
        }
        await startPlayback(runtime, relativePath, {
          onError: () => reply(context, username, 'Unable to start playback.')
        });
        await reply(context, username, 'Playback started.');
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
      onWhisper: async ({ bot, username, message }) => {
        try {
          return await commandRouter.handle(username, message, { bot });
        } catch (error) {
          logger.error('player command failed', { error: error.message });
          publish({ type: 'error', code: 'PLAYER_COMMAND_FAILED', message: error.message });
          await reply({ bot }, username, 'Unable to complete command.');
          return true;
        }
      }
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
module.exports = { buildSearchReplyMessages, createApp, formatSearchResultHover, getSearchPageWindow };
