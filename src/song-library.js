const fs = require('node:fs/promises');
const path = require('node:path');
const Fuse = require('fuse.js');

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function outsideRepositoryError() {
  return new Error('song path is outside song repository');
}

function toRelativeSongPath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function createSongLibrary(root, options = {}) {
  const rootPath = path.resolve(root);
  const realRoot = fs.realpath(rootPath);

  async function assertInsideRoot(candidatePath) {
    const canonicalRoot = await realRoot;
    if (!isInside(canonicalRoot, candidatePath)) {
      throw outsideRepositoryError();
    }
  }

  async function scanDirectory(directory, visited, songs) {
    const canonicalDirectory = await fs.realpath(directory);
    await assertInsideRoot(canonicalDirectory);
    if (visited.has(canonicalDirectory)) {
      return;
    }
    visited.add(canonicalDirectory);

    const entries = await fs.readdir(canonicalDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(canonicalDirectory, entry.name);
      let canonicalEntry;
      try {
        canonicalEntry = await fs.realpath(entryPath);
      } catch (error) {
        if (error.code === 'ENOENT') {
          continue;
        }
        throw error;
      }

      if (!isInside(await realRoot, canonicalEntry)) {
        continue;
      }

      const stat = await fs.stat(canonicalEntry);
      if (stat.isDirectory()) {
        await scanDirectory(canonicalEntry, visited, songs);
      } else if (stat.isFile() && path.extname(canonicalEntry).toLowerCase() === '.nbs') {
        songs.add(toRelativeSongPath(await realRoot, canonicalEntry));
      }
    }
  }

  async function scan() {
    const canonicalRoot = await realRoot;
    if (typeof options.scan === 'function') {
      const results = await options.scan(canonicalRoot);
      if (!Array.isArray(results)) {
        throw new TypeError('song library scan must return an array');
      }
      return [...results]
        .filter((item) => typeof item === 'string' && item.toLowerCase().endsWith('.nbs'))
        .map((item) => item.split('\\').join('/'))
        .sort((left, right) => left.localeCompare(right));
    }

    const songs = new Set();
    await scanDirectory(canonicalRoot, new Set(), songs);
    return [...songs].sort((left, right) => left.localeCompare(right));
  }

  async function resolveSong(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      throw outsideRepositoryError();
    }
    if (path.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) || path.posix.isAbsolute(relativePath)) {
      throw outsideRepositoryError();
    }

    const pathParts = relativePath.split(/[\\/]+/);
    if (pathParts.some((part) => part === '..')) {
      throw outsideRepositoryError();
    }
    if (path.extname(relativePath).toLowerCase() !== '.nbs') {
      throw new Error('song path must identify an NBS file');
    }

    const canonicalRoot = await realRoot;
    const candidate = path.resolve(canonicalRoot, ...pathParts);
    await assertInsideRoot(candidate);
    const canonicalSong = await fs.realpath(candidate);
    await assertInsideRoot(canonicalSong);
    return canonicalSong;
  }

  async function search(keyword, page = 1, pageSize = 10) {
    const songs = await scan();
    const query = String(keyword ?? '').trim();
    const matches = query === ''
      ? songs
      : new Fuse(songs, { includeScore: true, ignoreLocation: true })
        .search(query)
        .filter((result) => result.score <= 0.333)
        .map((result) => result.item);

    if (matches.length === 0) {
      return { items: [], page: 1, totalPages: 1, total: 0 };
    }

    const normalizedPageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;
    const totalPages = Math.ceil(matches.length / normalizedPageSize);
    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const normalizedPage = Math.min(requestedPage, totalPages);
    const start = (normalizedPage - 1) * normalizedPageSize;
    return {
      items: matches.slice(start, start + normalizedPageSize),
      page: normalizedPage,
      totalPages,
      total: matches.length
    };
  }

  return { scan, resolveSong, search };
}

module.exports = { createSongLibrary };
