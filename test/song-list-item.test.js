const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const minecraftData = require('minecraft-data');
const nbt = require('prismarine-nbt');
const { createDeserializer, createSerializer, states } = require('minecraft-protocol');

const { createSongListItem, setSongListInHand } = require('../src/song-list-item');

const registry = minecraftData('1.21.10');
const serializer = createSerializer({ state: states.PLAY, isServer: false, version: '1.21.10' });
const deserializer = createDeserializer({ state: states.PLAY, isServer: true, version: '1.21.10' });

function decodeUntrustedComponent(component) {
  const typeId = component.type === 'custom_name' ? 5 : 8;
  return serializer.proto.parsePacketBuffer('SlotComponent', Buffer.concat([Buffer.from([typeId]), component.data])).data;
}

function anonymousCompound(value) {
  const tag = nbt.comp(value);
  delete tag.name;
  return tag;
}

test('creates a paper item with serialized 1.21.10 song-list components', () => {
  const item = createSongListItem(registry, ['piano/one.nbs', 'piano/two.nbs'], 2, 9);

  assert.equal(item.name, 'paper');
  assert.ok(Buffer.isBuffer(item.components[0].data));
  assert.ok(Buffer.isBuffer(item.components[1].data));

  const packet = serializer.createPacketBuffer({ name: 'set_creative_slot', params: { slot: 36, item } });
  const parsed = deserializer.parsePacketBuffer(packet).data.params.item;
  assert.equal(parsed.addedComponentCount, 2);
  assert.deepEqual(decodeUntrustedComponent(parsed.components[0]).data, anonymousCompound({
    text: nbt.string('搜索结果 2/9'),
    color: nbt.string('aqua'),
    bold: nbt.byte(1),
    italic: nbt.byte(0)
  }));
  assert.deepEqual(decodeUntrustedComponent(parsed.components[1]).data, [
    anonymousCompound({ text: nbt.string('1. one'), color: nbt.string('white'), italic: nbt.byte(0) }),
    anonymousCompound({ text: nbt.string('2. two'), color: nbt.string('white'), italic: nbt.byte(0) }),
    anonymousCompound({ text: nbt.string('回复bot数字播放相应歌曲'), color: nbt.string('gray'), italic: nbt.byte(0) })
  ]);
});

test('clears an occupied held hotbar slot before writing the song-list item', async () => {
  const calls = [];
  const slots = [];
  slots[36] = { name: 'diamond' };
  const inventory = new EventEmitter();
  inventory.slots = slots;
  const bot = {
    registry,
    quickBarSlot: 0,
    inventory,
    _client: {
      write: (name, params) => {
        calls.push({ name, params });
        if (params.item?.name === 'paper') {
          queueMicrotask(() => {
            const confirmedItem = { name: 'paper', type: params.item.itemId, count: params.item.itemCount };
            slots[params.slot] = confirmedItem;
            inventory.emit(`updateSlot:${params.slot}`, null, confirmedItem);
          });
        }
      }
    }
  };

  await setSongListInHand(bot, ['piano/one.nbs'], 1, 1);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { name: 'set_creative_slot', params: { slot: 36, item: { itemCount: 0 } } });
  assert.equal(calls[1].name, 'set_creative_slot');
  assert.equal(calls[1].params.slot, 36);
  assert.equal(calls[1].params.item.components[1].type, 'lore');
});

test('waits for the held hotbar slot to confirm the generated paper', async () => {
  const inventory = new EventEmitter();
  inventory.slots = [];
  const bot = {
    registry,
    quickBarSlot: 0,
    inventory,
    _client: {
      write() {}
    }
  };

  let completed = false;
  const writePromise = setSongListInHand(bot, ['piano/one.nbs'], 1, 1).then(() => { completed = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(completed, false);

  const confirmedItem = { name: 'paper', type: registry.itemsByName.paper.id, count: 1 };
  inventory.slots[36] = confirmedItem;
  inventory.emit('updateSlot:36', null, confirmedItem);
  await writePromise;
  assert.equal(completed, true);
});

test('locally synchronizes the held paper when the protocol does not acknowledge creative slots', async () => {
  const inventory = new EventEmitter();
  inventory.slots = [];
  const synchronized = [];
  const bot = {
    registry,
    quickBarSlot: 0,
    inventory,
    supportFeature: (feature) => feature === 'noAckOnCreateSetSlotPacket',
    _setSlot: (slot, item) => {
      synchronized.push({ slot, item });
      inventory.slots[slot] = item;
      inventory.emit(`updateSlot:${slot}`, null, item);
    },
    _client: {
      write() {}
    }
  };

  await setSongListInHand(bot, ['piano/one.nbs'], 1, 1, { noAckGraceMs: 0 });

  assert.equal(synchronized.length, 1);
  assert.equal(synchronized[0].slot, 36);
  assert.equal(synchronized[0].item.name, 'paper');
});

test('does not overwrite an occupied held slot when the cleanup packet is rejected', async () => {
  let setCalls = 0;
  const slots = [];
  slots[36] = { name: 'diamond' };
  const bot = {
    registry,
    quickBarSlot: 0,
    inventory: { slots },
    _client: {
      write: () => {
        if (setCalls === 0) {
          setCalls += 1;
          throw new Error('Server rejected');
        }
        setCalls += 1;
      }
    }
  };

  await assert.rejects(setSongListInHand(bot, ['piano/one.nbs'], 1, 1), /Server rejected/);
  assert.equal(setCalls, 1);
});

test('reports each creative packet immediately before it is sent', async () => {
  const reports = [];
  const slots = [];
  slots[36] = { name: 'diamond' };
  const inventory = new EventEmitter();
  inventory.slots = slots;
  const bot = {
    registry,
    quickBarSlot: 0,
    inventory,
    _client: {
      version: '1.21.9',
      write(_name, params) {
        if (params.item?.name === 'paper') {
          queueMicrotask(() => {
            const confirmedItem = { name: 'paper', type: params.item.itemId, count: params.item.itemCount };
            slots[params.slot] = confirmedItem;
            inventory.emit(`updateSlot:${params.slot}`, null, confirmedItem);
          });
        }
      }
    }
  };

  await setSongListInHand(bot, ['piano/one.nbs'], 1, 1, {
    beforeWrite: (report) => reports.push(report)
  });

  assert.deepEqual(reports.map(({ componentDataBytes, ...report }) => report), [
    { kind: 'clear', slot: 36, protocolVersion: '1.21.9' },
    {
      kind: 'songList',
      slot: 36,
      protocolVersion: '1.21.9',
      itemId: registry.itemsByName.paper.id,
      addedComponentCount: 2
    }
  ]);
  assert.deepEqual(reports[1]?.componentDataBytes.map((bytes) => Number.isInteger(bytes) && bytes > 0), [true, true]);
});
