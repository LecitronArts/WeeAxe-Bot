const path = require('node:path');
const nbt = require('prismarine-nbt');
const { createSerializer, states } = require('minecraft-protocol');

const componentSerializer = createSerializer({
  state: states.PLAY,
  isServer: false,
  version: '1.21.10'
});

function songTitle(relativePath) {
  return path.posix.basename(String(relativePath)).replace(/\.nbs$/i, '');
}

function encodeComponentData(type, data) {
  const encodedComponent = componentSerializer.proto.createPacketBuffer('SlotComponent', { type, data });
  let offset = 0;
  do {
    if (offset >= encodedComponent.length) throw new Error('could not encode item component type');
  } while ((encodedComponent[offset++] & 0x80) !== 0);
  return encodedComponent.subarray(offset);
}

function textComponent(value) {
  const component = { text: nbt.string(String(value.text ?? '')) };
  if (value.color !== undefined) component.color = nbt.string(String(value.color));
  if (value.bold !== undefined) component.bold = nbt.byte(value.bold ? 1 : 0);
  if (value.italic !== undefined) component.italic = nbt.byte(value.italic ? 1 : 0);
  return nbt.comp(component);
}

function createSongListItem(registry, items, page, totalPages) {
  const paper = registry?.itemsByName?.paper;
  if (!paper) throw new Error('paper item is unavailable for this protocol version');

  const lore = items.length > 0
    ? items.map((relativePath, index) => textComponent({
      text: `${index + 1}. ${songTitle(relativePath)}`,
      color: 'white',
      italic: false
    }))
    : [textComponent({ text: '没有找到歌曲', color: 'gray', italic: false })];
  lore.push(textComponent({ text: '回复bot数字播放相应歌曲', color: 'gray', italic: false }));

  const customName = textComponent({ text: `搜索结果 ${page}/${totalPages}`, color: 'aqua', bold: true, italic: false });
  return {
    name: 'paper',
    itemCount: 1,
    itemId: paper.id,
    addedComponentCount: 2,
    removedComponentCount: 0,
    components: [
      { type: 'custom_name', data: encodeComponentData('custom_name', customName) },
      { type: 'lore', data: encodeComponentData('lore', lore) }
    ],
    removeComponents: []
  };
}

function waitForHeldSongList(bot, slot, item, timeoutMs = 1500) {
  const inventory = bot.inventory;
  const event = `updateSlot:${slot}`;
  if (typeof inventory?.on !== 'function' || typeof inventory.off !== 'function') {
    throw new Error('creative inventory confirmation is unavailable');
  }

  let cancel = () => {};
  const promise = new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      inventory.off(event, onUpdate);
    };
    const finish = (error) => {
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onUpdate = (_oldItem, newItem) => {
      if (newItem?.type === item.itemId && newItem.count === item.itemCount) finish();
    };
    cancel = (error = new Error('creative slot write failed')) => finish(error);
    inventory.on(event, onUpdate);
    timeout = setTimeout(() => finish(new Error('song list item was not confirmed by server')), timeoutMs);
  });
  return { promise, cancel };
}

function waitForCreativeSlotRejection(bot, slot, item, timeoutMs) {
  const inventory = bot.inventory;
  const event = `updateSlot:${slot}`;
  return new Promise((resolve, reject) => {
    let timeout;
    const cleanup = () => {
      clearTimeout(timeout);
      inventory.off(event, onUpdate);
    };
    const onUpdate = (_oldItem, newItem) => {
      if (newItem?.type === item.itemId) return;
      cleanup();
      reject(new Error('server rejected the song list item'));
    };
    inventory.on(event, onUpdate);
    timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, timeoutMs);
  });
}

function usesNoAckCreativeSlots(bot) {
  return typeof bot?.supportFeature === 'function'
    && bot.supportFeature('noAckOnCreateSetSlotPacket')
    && typeof bot?._setSlot === 'function';
}

function createLocalPaperItem(bot, item) {
  const Item = require('prismarine-item')(bot.registry);
  return new Item(item.itemId, item.itemCount);
}

async function setSongListInHand(bot, items, page, totalPages, { beforeWrite = () => {}, noAckGraceMs = 400 } = {}) {
  const slot = Number(bot?.quickBarSlot) + 36;
  if (!Number.isInteger(slot) || slot < 36 || slot > 44) throw new Error('bot selected hotbar slot is unavailable');
  if (typeof bot?._client?.write !== 'function' || !Array.isArray(bot?.inventory?.slots)) {
    throw new Error('creative inventory access is unavailable');
  }

  if (bot.inventory.slots[slot]) {
    beforeWrite({ kind: 'clear', slot, protocolVersion: bot._client.version });
    bot._client.write('set_creative_slot', { slot, item: { itemCount: 0 } });
  }
  const item = createSongListItem(bot.registry, items, page, totalPages);
  beforeWrite({
    kind: 'songList',
    slot,
    protocolVersion: bot._client.version,
    itemId: item.itemId,
    addedComponentCount: item.addedComponentCount,
    componentDataBytes: item.components.map((component) => component.data.length)
  });
  const noAck = usesNoAckCreativeSlots(bot);
  const confirmation = noAck ? undefined : waitForHeldSongList(bot, slot, item);
  try {
    bot._client.write('set_creative_slot', { slot, item });
    if (noAck) bot._setSlot(slot, createLocalPaperItem(bot, item));
  } catch (error) {
    if (confirmation) {
      confirmation.cancel(error);
      await confirmation.promise.catch(() => {});
    }
    throw error;
  }
  if (noAck) await waitForCreativeSlotRejection(bot, slot, item, noAckGraceMs);
  else await confirmation.promise;
  return item;
}

module.exports = { createSongListItem, setSongListInHand };
