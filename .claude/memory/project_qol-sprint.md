---
name: project-qol-sprint
description: Quality-of-life sprint — 4 cleanup/improvement items before next feature work
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Quality-of-life sprint to close small/foundational items before adding more features.

**Current state:** Item 1 complete, items 2–4 remaining.

**Items (in suggested order):**

1. ~~**Remove vestigial IPC handlers**~~ — Done (3725755). Removed `jobs:updateStatus`, `jobs:updateProgress`, `jobs:complete`, `jobs:fail` from IPC, preload, preload .d.ts, Platform interface, and electron.ts. `jobs:updateAnalysis` also vestigial but left as out-of-scope.

2. **Fix stale design.md** — Audio Analysis section says "running in the renderer process" and "BPM detection only" but beat detection now runs in main process via `src/main/mixer/audio.ts` using `BeatTrackerMultiFeature`. Update to reflect reality. ~5 min.

3. **Retry mechanism for failed jobs** — Add a "Retry" button in `JobQueue.vue` for failed jobs. Reset job status to `pending`, clear error field. Runner picks it up via existing `processQueue()` flow. Need a new `retryJob` DB function + IPC handler. ~30 min.

4. **Push-based progress** — Replace 1s polling in Pinia store with `webContents.send` from runner. Add `onJobProgress`/`onJobStatusChange` events via preload contextBridge. Store subscribes on mount. Remove `pollTimer` and `startPolling`/`stopPolling`. More responsive, cleaner architecture. ~1-2 hrs.

**Deferred from this sprint (too large or unclear):**
- Video preprocessing (probe-first normalization) — real feature, own session
- Batch operations — needs scoping first (what does "batch" mean?)

**After this sprint:** Onset detection / section segmentation for musically intelligent cuts, or video preprocessing.

**Why:** Close tech debt and improve UX foundation before adding more features. Each item is small enough to implement-test-commit independently.

**How to apply:** Execute items in order. Each is independently committable. Use plan mode for item 4 (push-based progress) as it touches multiple layers.
