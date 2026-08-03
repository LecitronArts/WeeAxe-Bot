const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createSongLibrary } = require('../src/song-library');

test('rejects traversal and keeps an empty search on page one', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-songs-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const library = createSongLibrary(root, { scan: async () => [] });

  await assert.rejects(() => library.resolveSong('../secret.nbs'), /outside song repository/);
  assert.deepEqual(await library.search('missing', 9, 5), {
    items: [], page: 1, totalPages: 1, total: 0
  });
});

test('paginates real NBS files by their relative paths', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-songs-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  await Promise.all([
    fs.promises.writeFile(path.join(root, 'alpha.nbs'), ''),
    fs.promises.writeFile(path.join(root, 'bravo.nbs'), ''),
    fs.promises.writeFile(path.join(root, 'charlie.nbs'), '')
  ]);
  const library = createSongLibrary(root);

  assert.deepEqual(await library.search('', 2, 2), {
    items: ['charlie.nbs'], page: 2, totalPages: 2, total: 3
  });
});

test('rejects a song symlink that escapes the repository', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-songs-'));
  const outside = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'weeaxe-outside-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  t.after(() => fs.promises.rm(outside, { recursive: true, force: true }));
  const target = path.join(outside, 'secret.nbs');
  const link = path.join(root, 'escape.nbs');
  await fs.promises.writeFile(target, '');
  await fs.promises.symlink(target, link, 'file');

  const library = createSongLibrary(root);
  await assert.rejects(() => library.resolveSong('escape.nbs'), /outside song repository/);
});
