function createPrivateReplyScheduler({ sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)) } = {}) {
  const pendingUsernames = new Set();
  let queue = Promise.resolve();
  let activeCooldown;

  function beginCooldown(username) {
    let release;
    const interrupted = new Promise((resolve) => { release = resolve; });
    const cooldown = {
      username,
      release,
      finished: Promise.race([
        Promise.resolve().then(() => sleep(10000)),
        interrupted
      ]).catch(() => {})
    };
    activeCooldown = cooldown;
    cooldown.finished.finally(() => {
      if (activeCooldown === cooldown) activeCooldown = undefined;
    });
  }

  async function waitForCooldown(username, continueAfterOwnCooldown) {
    const cooldown = activeCooldown;
    if (!cooldown) return;
    if (continueAfterOwnCooldown && cooldown.username === username) cooldown.release();
    await cooldown.finished;
  }

  function schedule(username, task, { continueAfterOwnCooldown = false } = {}) {
    if (pendingUsernames.has(username)) return { dropped: true };

    pendingUsernames.add(username);
    const scheduledTask = queue.then(async () => {
      await waitForCooldown(username, continueAfterOwnCooldown);
      let succeeded = false;
      try {
        await task();
        succeeded = true;
        return { dropped: false };
      } finally {
        pendingUsernames.delete(username);
        if (succeeded) beginCooldown(username);
      }
    });

    queue = scheduledTask.catch(() => {});
    return scheduledTask;
  }

  return { schedule };
}

module.exports = { createPrivateReplyScheduler };
