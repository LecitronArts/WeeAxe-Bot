const MINECRAFT_PROTOCOL_VERSION = '1.21.10';

function createBotManager({ mineflayer, config, logger, onStatus = () => {}, onWhisper = async () => {}, sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) }) {
  let mainBot;
  let closing = false;
  let reconnectTimer;
  let childBots = [];
  const pendingCommands = new Set();

  function report(state, extra = {}) { onStatus({ state, childBotCount: childBots.length, ...extra }); }
  function formatKickReason(reason) {
    if (reason === undefined || reason === null) return 'no reason supplied by server';
    if (typeof reason === 'string') return reason;
    try {
      return JSON.stringify(reason) ?? String(reason);
    } catch {
      return String(reason);
    }
  }
  function dispatchPlayerCommand(bot, username, message) {
    if (mainBot !== bot || closing || username === bot.username || username === 'me' || username !== config.botOwner) return;
    const key = `${username}\u0000${message}`;
    if (pendingCommands.has(key)) return;
    pendingCommands.add(key);
    Promise.resolve()
      .then(() => onWhisper({ bot, username, message }))
      .catch((error) => logger.error('player command failed', { error: error.message }))
      .finally(() => pendingCommands.delete(key));
  }
  function parseServerPrivateCommand(bot, message) {
    const botName = String(bot.username).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ownerName = String(config.botOwner).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`^\\[(${ownerName})(?=[^A-Za-z0-9_]).*?\\s->\\s(?:me|${botName})\\]\\s*(#\\S(?:.*\\S)?|[1-8])\\s*$`, 'i').exec(message);
    return match ? { username: match[1], message: match[2] } : undefined;
  }
  function attachMain(bot) {
    bot.on('spawn', () => { bot.chat(`/login ${config.loginPassword}`); bot.chat('/pchat'); bot.chat('/piano keyboard unicode'); report('connected'); });
    bot.on('error', (error) => logger.error('main bot error', { error: error.message }));
    bot.on('kicked', (reason) => {
      const kickReason = formatKickReason(reason);
      logger.error(`main bot was kicked: ${kickReason}`, { reason: kickReason });
    });
    bot.on('whisper', (username, message) => dispatchPlayerCommand(bot, username, message));
    bot.on('messagestr', (message) => {
      if (typeof message !== 'string') return;
      const command = parseServerPrivateCommand(bot, message);
      if (command) dispatchPlayerCommand(bot, command.username, command.message);
    });
    bot.on('end', () => {
      if (mainBot === bot) mainBot = undefined;
      report('disconnected');
      if (!closing) reconnectTimer = setTimeout(() => connect(), config.reconnectDelayMs);
    });
  }
  function connect() {
    if (mainBot && !mainBot._client?.ended) return mainBot;
    clearTimeout(reconnectTimer);
    closing = false;
    mainBot = mineflayer.createBot({ host: config.serverHost, port: config.serverPort, username: config.mainBotName, auth: 'offline', version: MINECRAFT_PROTOCOL_VERSION });
    attachMain(mainBot); report('connecting'); return mainBot;
  }
  async function releaseChildBots() {
    for (const bot of childBots) if (bot?._client && !bot._client.ended) bot.quit();
    childBots = []; report(mainBot?._client?.ended ? 'disconnected' : 'connected');
  }
  async function getPlaybackBots(requiredCount = 1) {
    if (!mainBot) throw new Error('main bot is not connected');
    while (childBots.length + 1 < requiredCount) {
      const index = childBots.length + 1;
      const bot = mineflayer.createBot({ host: config.serverHost, port: config.serverPort, username: `${config.mainBotName}${'Z'.repeat(index)}`, auth: 'offline', version: MINECRAFT_PROTOCOL_VERSION });
      bot.on('spawn', () => { bot.chat(`/login ${config.loginPassword}`); bot.chat('/piano keyboard unicode'); bot.chat(`/tp ${config.mainBotName}`); });
      childBots.push(bot);
    }
    report('connected'); return [...childBots, mainBot];
  }
  async function disconnect() {
    closing = true; clearTimeout(reconnectTimer); await releaseChildBots();
    const bot = mainBot;
    mainBot = undefined; report('disconnected');
    if (bot?._client && !bot._client.ended) bot.quit();
  }
  async function ride(username) {
    const bots = childBots.length > 0 ? childBots : [mainBot];
    let activated = 0;
    await Promise.all(bots.map(async (bot) => {
      if (!bot?._client || bot._client.ended || typeof bot.chat !== 'function') return;
      bot.chat(`/tp ${username}`);
      bot.clearControlStates?.();
      await sleep(2000);
      const target = bot.nearestEntity?.((entity) => entity?.username === username);
      if (!target || typeof bot.activateEntityAt !== 'function') return;
      await bot.activateEntityAt(target, target.position);
      activated += 1;
    }));
    if (activated === 0) throw new Error('requested player is not available for riding');
  }
  return { connect, disconnect, getMainBot: () => mainBot, getPlaybackBots, releaseChildBots, ride };
}

module.exports = { createBotManager };
