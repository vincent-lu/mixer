---
name: project-qol-sprint
description: Quality-of-life sprint — 4 cleanup/improvement items before next feature work
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Quality-of-life sprint to close small/foundational items before adding more features.

**Current state:** All 4 items complete.

**Items (in suggested order):**

1. ~~**Remove vestigial IPC handlers**~~ — Done (3725755). Removed `jobs:updateStatus`, `jobs:updateProgress`, `jobs:complete`, `jobs:fail` from IPC, preload, preload .d.ts, Platform interface, and electron.ts. `jobs:updateAnalysis` also vestigial but left as out-of-scope.

2. ~~**Fix stale design.md**~~ — Done (2062eb7). Updated Audio Analysis Pipeline section to reflect main-process beat detection via `BeatTrackerMultiFeature`.

3. ~~**Retry mechanism for failed jobs**~~ — Done (620038b). Added `retryJob` DB function, IPC handler, preload/Platform/store/UI across 8 files. Retry button (arrow-rotate-right icon) shows on failed jobs.

4. ~~**Push-based progress**~~ — Done (pending commit). Replaced 1s polling with `webContents.send` push events. Runner broadcasts `job:progress` (lightweight) and `job:status-change` (full MixJob). Store subscribes/unsubscribes via preload event listeners. Fixed race condition where broadcast arrived before create IPC response caused duplicate jobs.

**Deferred from this sprint (too large or unclear):**
- ~~Video preprocessing (probe-first normalization)~~ — implemented in a later session (in-place normalization with codec guard)
- Batch operations — needs scoping first (what does "batch" mean?)

**After this sprint:** Onset detection / section segmentation for musically intelligent cuts, or visual effects/transitions.

**Why:** Close tech debt and improve UX foundation before adding more features. Each item is small enough to implement-test-commit independently.

**How to apply:** Execute items in order. Each is independently committable. Use plan mode for item 4 (push-based progress) as it touches multiple layers.
