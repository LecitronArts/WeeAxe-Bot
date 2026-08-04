function createSearchSelection({ ttlMs = 60_000, now = () => Date.now() } = {}) {
  const selections = new Map();

  function getActiveSelection(username) {
    const selection = selections.get(username);
    if (!selection) return undefined;
    if (selection.expiresAt < now()) {
      selections.delete(username);
      return undefined;
    }
    return selection;
  }

  function save(username, items, { query, page, totalPages } = {}) {
    selections.set(username, { items: [...items], query, page, totalPages, expiresAt: now() + ttlMs });
  }

  function get(username, choice) {
    const selection = getActiveSelection(username);
    if (!selection) return undefined;
    return selection.items[choice - 1];
  }

  function getQuery(username) {
    return getActiveSelection(username)?.query;
  }

  function isActivePage(username, query, requestedPage) {
    const selection = getActiveSelection(username);
    const page = Number(requestedPage);
    return Boolean(selection
      && selection.query === query
      && Number.isSafeInteger(page)
      && page >= 1
      && page <= selection.totalPages);
  }

  return { save, get, getQuery, isActivePage };
}

module.exports = { createSearchSelection };
