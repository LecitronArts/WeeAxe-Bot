# Search Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore legacy-style, rate-limited, five-song in-game search pagination.

**Architecture:** A focused private-reply scheduler serializes search batches and rejects duplicate player batches. The application uses it only for game commands; the WebSocket handler continues to request ten songs per page.

**Tech Stack:** Node.js, node:test, Mineflayer Bot whisper API.

---

### Task 1: Add The Private Reply Scheduler

**Files:**
- Create: `src/private-reply-scheduler.js`
- Test: `test/private-reply-scheduler.test.js`

- [ ] Write failing tests for global serialization, duplicate-player rejection, and ten-second post-batch delay using an injected `sleep` function.
- [ ] Run `node --test test/private-reply-scheduler.test.js` and verify the tests fail because the module is absent.
- [ ] Implement `createPrivateReplyScheduler({ sleep })` with a promise tail and an active-player set. `schedule(username, task)` returns `{ dropped: true }` for an active username; otherwise it runs the task after the preceding task, then retains the queue for 10000 milliseconds.
- [ ] Run `node --test test/private-reply-scheduler.test.js` and verify it passes.
- [ ] Commit only the scheduler and its tests.

### Task 2: Restore Search Reply Pagination

**Files:**
- Modify: `src/app.js`
- Modify: `test/app.test.js`

- [ ] Write failing integration tests proving game search calls `library.search(query, page, 5)`, paces all reply messages by 150 milliseconds, renders up to five playable song rows, shows the current page, shows a three-page command window, and emits bounded previous/next commands.
- [ ] Run `node --test test/app.test.js` and verify the search tests fail because game search requests ten songs and sends no navigation.
- [ ] Add a game-search reply formatter that calls the scheduler. It emits the search header and count, then five or fewer `relativePath | #play relativePath` rows, then the legacy-style page footer. It sends each message through the existing source-Bot reply function and awaits 150 milliseconds between sends. A duplicate request replies `Search already in progress.` without joining the queue.
- [ ] Keep `searchSongs` in the control server on page size ten, preserving Flutter behavior.
- [ ] Run `node --test test/app.test.js` and verify it passes.
- [ ] Commit only the application, scheduler integration, and test changes.

### Task 3: Verify Runtime Behavior

**Files:**
- Verify: `src/private-reply-scheduler.js`
- Verify: `src/app.js`
- Verify: related Node tests

- [ ] Run `npm test` and verify all tests pass.
- [ ] Run `npm run check`, `node --check backend.js`, and `git diff --check`; verify each exits with code zero.
- [ ] Restart the administrator Flutter program, send its local `connect` control command, and confirm the Node process establishes the configured game-server TCP connection.
- [ ] In game, send `/tell Lemon_CK #search piano`, then the displayed next-page command. Confirm each page has no more than five result rows and that the Bot remains connected.
