const { fromArrayBuffer } = require('@nbsjs/core');

function decodeNbs(fileBuffer) {
  const song = fromArrayBuffer(new Uint8Array(fileBuffer).buffer);
  const ticks = [];
  for (let tick = 0; tick <= song.getLength(); tick += 1) {
    const notes = [];
    for (let layer = song.layers.getTotal() - 1; layer >= 0; layer -= 1) {
      const layerNotes = song.layers.all[layer]?.notes?.all;
      const note = layerNotes?.[String(tick)];
      if (note) notes.push({ instrument: note.instrument, key: note.key });
    }
    ticks.push(notes);
  }
  return { name: song.name || 'Unnamed song', timePerTick: song.getTimePerTick(), ticks };
}

function createPlaybackController(dependencies) {
  const decode = dependencies.decode || decodeNbs;
  const sleep = dependencies.sleep || ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let runId = 0;
  let playing = false;

  async function play(fileBuffer) {
    const currentRun = ++runId;
    playing = true;
    const song = decode(fileBuffer);
    const bots = await dependencies.getBots();
    if (!Array.isArray(bots) || bots.length === 0) throw new Error('no playback bots are available');
    let transactionId = 1;
    let botIndex = 0;

    for (let tick = 0; tick < song.ticks.length; tick += 1) {
      if (currentRun !== runId) break;
      for (const note of song.ticks[tick]) {
        if (currentRun !== runId) break;
        const text = dependencies.toPacketText(note.instrument, note.key);
        if (text) {
          await dependencies.send(bots[botIndex], transactionId++, text);
          botIndex = (botIndex + 1) % bots.length;
        }
      }
      if (currentRun !== runId) break;
      if (tick < song.ticks.length - 1) await sleep(song.timePerTick);
      dependencies.onProgress?.({ songName: song.name, tick: tick + 1, totalTicks: song.ticks.length, botCount: bots.length, playing: currentRun === runId });
    }

    if (currentRun === runId) {
      playing = false;
      dependencies.onProgress?.({ songName: song.name, tick: song.ticks.length, totalTicks: song.ticks.length, botCount: bots.length, playing: false });
    }
  }

  function stop() {
    runId += 1;
    playing = false;
    return dependencies.releaseBots?.();
  }

  return { play, stop, isPlaying: () => playing };
}

module.exports = { createPlaybackController, decodeNbs };
