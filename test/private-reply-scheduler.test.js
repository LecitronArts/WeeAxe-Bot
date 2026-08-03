const test = require('node:test');
const assert = require('node:assert/strict');

const { createPrivateReplyScheduler } = require('../src/private-reply-scheduler');

test('runs distinct users in global FIFO order without overlapping tasks', async () => {
  const events = [];
  let releaseFirst;
  const scheduler = createPrivateReplyScheduler({
    sleep: async () => { events.push('sleep'); }
  });

  const first = scheduler.schedule('Alice', async () => {
    events.push('first:start');
    await new Promise((resolve) => { releaseFirst = resolve; });
    events.push('first:end');
  });
  const second = scheduler.schedule('Bob', async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await new Promise(setImmediate);
  assert.deepEqual(events, ['first:start']);
  releaseFirst();

  assert.deepEqual(await first, { dropped: false });
  assert.deepEqual(await second, { dropped: false });
  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'sleep',
    'second:start',
    'second:end',
    'sleep'
  ]);
});

test('drops a duplicate username while its task is executing', async () => {
  let releaseTask;
  let duplicateRuns = 0;
  const scheduler = createPrivateReplyScheduler({ sleep: async () => {} });
  const first = scheduler.schedule('Alice', () => new Promise((resolve) => { releaseTask = resolve; }));

  await new Promise(setImmediate);
  assert.deepEqual(scheduler.schedule('Alice', () => { duplicateRuns += 1; }), { dropped: true });
  releaseTask();

  assert.deepEqual(await first, { dropped: false });
  assert.equal(duplicateRuns, 0);
});

test('queues different users even when an earlier task is pending', async () => {
  const runs = [];
  const scheduler = createPrivateReplyScheduler({ sleep: async () => {} });

  const first = scheduler.schedule('Alice', async () => { runs.push('Alice'); });
  const second = scheduler.schedule('Bob', async () => { runs.push('Bob'); });

  assert.notDeepEqual(second, { dropped: true });
  await Promise.all([first, second]);
  assert.deepEqual(runs, ['Alice', 'Bob']);
});

test('continues queued tasks and clears the username after a task throws', async () => {
  const runs = [];
  const scheduler = createPrivateReplyScheduler({ sleep: async () => {} });
  const failed = scheduler.schedule('Alice', async () => {
    runs.push('failed');
    throw new Error('reply failed');
  });
  const following = scheduler.schedule('Bob', async () => { runs.push('following'); });

  await assert.rejects(failed, /reply failed/);
  assert.deepEqual(await following, { dropped: false });
  assert.deepEqual(runs, ['failed', 'following']);

  assert.deepEqual(await scheduler.schedule('Alice', async () => { runs.push('retry'); }), { dropped: false });
  assert.deepEqual(runs, ['failed', 'following', 'retry']);
});

test('does not cool down after a task throws before running the next user', async () => {
  const delays = [];
  const runs = [];
  const scheduler = createPrivateReplyScheduler({
    sleep: async (milliseconds) => { delays.push(milliseconds); }
  });
  const failed = scheduler.schedule('Alice', async () => { throw new Error('reply failed'); });
  const following = scheduler.schedule('Bob', async () => { runs.push('Bob'); });

  await assert.rejects(failed, /reply failed/);
  assert.deepEqual(await following, { dropped: false });
  assert.deepEqual(runs, ['Bob']);
  assert.deepEqual(delays, [10000]);
});

test('queues a username again after its successful task while global cooldown is pending', async () => {
  const events = [];
  let releaseCooldown;
  const cooldown = new Promise((resolve) => { releaseCooldown = resolve; });
  const scheduler = createPrivateReplyScheduler({
    sleep: async () => cooldown
  });
  const first = scheduler.schedule('Alice', async () => { events.push('first'); });

  await new Promise(setImmediate);
  const second = scheduler.schedule('Alice', async () => { events.push('second'); });
  assert.notDeepEqual(second, { dropped: true });
  assert.deepEqual(events, ['first']);

  releaseCooldown();
  assert.deepEqual(await first, { dropped: false });
  assert.deepEqual(await second, { dropped: false });
  assert.deepEqual(events, ['first', 'second']);
});

test('waits 10000ms after every completed task', async () => {
  const delays = [];
  const scheduler = createPrivateReplyScheduler({
    sleep: async (milliseconds) => { delays.push(milliseconds); }
  });

  await scheduler.schedule('Alice', async () => {});
  await scheduler.schedule('Bob', async () => {});

  assert.deepEqual(delays, [10000, 10000]);
});
