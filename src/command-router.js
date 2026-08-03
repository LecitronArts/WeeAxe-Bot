function createCommandRouter({ search, play, stop, ride, whisper, commandPolicy = {}, mainBotName = '' }) {
  const policy = { allowPlay: true, allowStop: true, allowRide: true, ...commandPolicy };
  async function disabled(username) {
    await whisper(username, 'This command is disabled.');
  }

  async function handle(username, message) {
    if (message.startsWith('#search ')) {
      const raw = message.slice('#search '.length).trim();
      const comma = raw.lastIndexOf(',');
      const query = comma < 0 ? raw : raw.slice(0, comma).trim();
      const page = comma < 0 ? 1 : Math.max(1, Number.parseInt(raw.slice(comma + 1), 10) || 1);
      await search(query, page, username, mainBotName);
      return true;
    }
    if (message.startsWith('#play ')) {
      if (!policy.allowPlay) { await disabled(username); return true; }
      await play(message.slice('#play '.length).trim(), username);
      return true;
    }
    if (message === '#stop') {
      if (!policy.allowStop) { await disabled(username); return true; }
      await stop(username);
      return true;
    }
    if (message === '#ride') {
      if (!policy.allowRide) { await disabled(username); return true; }
      await ride(username);
      return true;
    }
    return false;
  }
  return { handle };
}

module.exports = { createCommandRouter };
