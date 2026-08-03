function sendTabComplete(bot, transactionId, text) {
  if (!bot?._client || bot._client.ended || typeof bot._client.write !== 'function') {
    throw new Error('bot connection is unavailable');
  }
  bot._client.write('tab_complete', { transactionId, text });
}

module.exports = { sendTabComplete };
