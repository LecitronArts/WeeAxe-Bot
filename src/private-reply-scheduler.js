function createPrivateReplyScheduler({ sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) } = {}) {
  const pendingUsernames = new Set();
  let queue = Promise.resolve();

  function schedule(username, task) {
    if (pendingUsernames.has(username)) return { dropped: true };

    pendingUsernames.add(username);
    const scheduledTask = queue.then(async () => {
      try {
        await task();
        return { dropped: false };
      } finally {
        try {
          await sleep(10000);
        } finally {
          pendingUsernames.delete(username);
        }
      }
    });

    queue = scheduledTask.catch(() => {});
    return scheduledTask;
  }

  return { schedule };
}

module.exports = { createPrivateReplyScheduler };
