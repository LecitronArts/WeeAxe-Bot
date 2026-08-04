function createCommandRouter({ search, pick, play, stop, ride, whisper, commandPolicy = {}, mainBotName = '' }) {
  const policy = { allowPlay: true, allowStop: true, allowRide: true, ...commandPolicy };
  async function disabled(username, context) {
    await whisper(username, 'This command is disabled.', context);
  }

  async function handle(username, message, context) {
    if (message === '#search') {
      await whisper(username, 'Usage: #search <query>[,page]', context);
      return true;
    }
    if (message.startsWith('#search ')) {
      const raw = message.slice('#search '.length).trim();
      const comma = raw.lastIndexOf(',');
      const query = comma < 0 ? raw : raw.slice(0, comma).trim();
      const page = comma < 0 ? 1 : Math.max(1, Number.parseInt(raw.slice(comma + 1), 10) || 1);
      await search(query, page, username, mainBotName, context);
      return true;
    }
    if (message === '#pick') {
      await whisper(username, 'Usage: #pick <number>', context);
      return true;
    }
    const rawChoice = message.startsWith('#pick ')
      ? message.slice('#pick '.length).trim()
      : message.trim();
    if (message.startsWith('#pick ') || /^[1-9]\d*$/.test(rawChoice)) {
      if (!policy.allowPlay) { await disabled(username, context); return true; }
      if (!/^[1-9]\d*$/.test(rawChoice)) {
        await whisper(username, 'Usage: #pick <number>', context);
        return true;
      }
      await pick(Number.parseInt(rawChoice, 10), username, context);
      return true;
    }
    if (message === '#play') {
      await whisper(username, 'Usage: #play <relative-song-path.nbs>', context);
      return true;
    }
    if (message.startsWith('#play ')) {
      if (!policy.allowPlay) { await disabled(username, context); return true; }
      await play(message.slice('#play '.length).trim(), username, context);
      return true;
    }
    if (message === '#stop') {
      if (!policy.allowStop) { await disabled(username, context); return true; }
      await stop(username, context);
      return true;
    }
    if (message === '#ride') {
      if (!policy.allowRide) { await disabled(username, context); return true; }
      await ride(username, context);
      return true;
    }
    return false;
  }
  return { handle };
}

module.exports = { createCommandRouter };
