const test = require('node:test');
const assert = require('node:assert/strict');

const { createSearchSelection } = require('../src/search-selection');

test('resolves one-based choices from the caller most recent search page', () => {
  const selection = createSearchSelection({ now: () => 1_000 });

  selection.save('Admin', ['piano/first.nbs', 'piano/second.nbs']);

  assert.equal(selection.get('Admin', 1), 'piano/first.nbs');
  assert.equal(selection.get('Admin', 2), 'piano/second.nbs');
  assert.equal(selection.get('Admin', 3), undefined);
  assert.equal(selection.get('Guest', 1), undefined);
});

test('expires an inactive page selection', () => {
  let now = 1_000;
  const selection = createSearchSelection({ now: () => now, ttlMs: 60_000 });
  selection.save('Admin', ['piano/first.nbs']);
  now += 60_001;

  assert.equal(selection.get('Admin', 1), undefined);
});

test('keeps the search query only for the active selection lifetime', () => {
  let now = 1_000;
  const selection = createSearchSelection({ now: () => now, ttlMs: 60_000 });
  selection.save('Admin', ['piano/first.nbs'], { query: 'piano' });

  assert.equal(selection.getQuery('Admin'), 'piano');
  now += 60_001;
  assert.equal(selection.getQuery('Admin'), undefined);
});

test('recognizes a valid page of the caller active search', () => {
  const selection = createSearchSelection({ now: () => 1_000 });
  selection.save('Admin', ['piano/first.nbs'], { query: 'piano', page: 2, totalPages: 3 });

  assert.equal(selection.isActivePage('Admin', 'piano', 3), true);
  assert.equal(selection.isActivePage('Admin', 'piano', 4), false);
  assert.equal(selection.isActivePage('Admin', 'other', 3), false);
  assert.equal(selection.isActivePage('Guest', 'piano', 3), false);
});
