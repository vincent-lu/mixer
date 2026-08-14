---
name: feedback-ipc-event-race
description: Push event handlers must never add items — only update existing — due to IPC ordering race with invoke responses
metadata:
  type: feedback
---

Push event handlers in the store must only update existing items, never add new ones via an `else` branch.

**Why:** When an IPC handler calls `notifyNewJob()` synchronously before returning, `executeJob` runs synchronously until its first `await`. The `webContents.send` broadcast arrives at the renderer before the `ipcRenderer.invoke` response. If the event handler adds the item, the subsequent `create()` return also adds it — causing duplicates. Only `create()` and `load()` should be canonical sources for adding items to reactive arrays.

**How to apply:** Any `onSomethingChange` event listener that receives pushed data should `findIndex` + replace, with no `else { unshift }` fallback. This applies whenever fire-and-forget async functions broadcast events before the triggering IPC invoke has returned.
