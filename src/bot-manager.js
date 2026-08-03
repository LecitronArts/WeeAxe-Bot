function createBotManager({ mineflayer, config, logger, onStatus = () => {} }) {
  let mainBot;
  let closing = false;
  let reconnectTimer;
  let childBots = [];

  function report(state, extra = {}) { onStatus({ state, childBotCount: childBots.length, ...extra }); }
  function attachMain(bot) {
    bot.on('spawn', () => { bot.chat(`/login ${config.loginPassword}`); bot.chat('/piano keyboard unicode'); report('connected'); });
    bot.on('error', (error) => logger.error('main bot error', { error: error.message }));
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
    mainBot = mineflayer.createBot({ host: config.serverHost, port: config.serverPort, username: config.mainBotName, auth: 'offline' });
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
      const bot = mineflayer.createBot({ host: config.serverHost, port: config.serverPort, username: `${config.mainBotName}${'Z'.repeat(index)}`, auth: 'offline' });
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
  return { connect, disconnect, getMainBot: () => mainBot, getPlaybackBots, releaseChildBots };
}

module.exports = { createBotManager };
