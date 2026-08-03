const test = require('node:test');
const assert = require('node:assert/strict');

test('npm test sets npm_lifecycle_event to test', () => {
  assert.equal(process.env.npm_lifecycle_event, 'test');
});
