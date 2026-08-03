function createPrivateReplyScheduler({ sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) } = {}) {
  const pendingUsernames = new Set();
  let queue = Promise.resolve();

  function schedule(username, task) {
    if (pendingUsernames.has(username)) return { dropped: true };

    pendingUsernames.add(username);
    const scheduledTask = queue.then(async () => {
      let succeeded = false;
      try {
        await task();
        succeeded = true;
        return { dropped: false };
      } finally {
        pendingUsernames.delete(username);
        if (succeeded) await sleep(10000);
      }
    });

    queue = scheduledTask.catch(() => {});
    return scheduledTask;
  }

  return { schedule };
}

module.exports = { createPrivateReplyScheduler };
