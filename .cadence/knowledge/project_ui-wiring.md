---
name: project-ui-wiring
description: Job runner wires Electron UI to mixing pipeline — implemented, potential polish remaining
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Wire the existing Electron UI (JobConfig + JobQueue) to `runMixPipeline` from `src/main/mixer/pipeline.ts`.

**Current state:** Implemented. `src/main/runner.ts` is the main-process job runner. "Start Mix" creates a DB record → `notifyNewJob()` triggers the runner → runner calls `runMixPipeline` with progress/abort forwarding → push events via `webContents.send` surface updates in real-time.

**What was built:**
- Job runner (`src/main/runner.ts`) — module-level singleton with `Map<number, AbortController>` for active jobs
- `processQueue()` respects `maxConcurrency` from `appState`, picks oldest pending jobs first (FIFO)
- `onProgress` callback updates DB progress + status (stage-change tracking avoids redundant writes)
- Cancellation: `cancelRunningJob(id)` aborts controller for running jobs, direct DB update for pending
- Startup recovery: jobs stuck in `analyzing`/`mixing` from prior crash marked `failed`
- Shutdown: `stopped` flag prevents `processQueue` re-entry after `stopRunner()` aborts controllers
- `startedAt` bug fixed in `updateJobStatus` — only set when not already set
- Push-based progress: runner broadcasts `job:progress` and `job:status-change` via `BrowserWindow.getAllWindows()`. Store subscribes via preload event listeners, patches jobs in-place.
- Retry mechanism: `retryJob` DB function resets to pending, IPC handler triggers `notifyNewJob()`, UI button on failed jobs

**Design decisions:**
- Push model via `webContents.send` (replaced 1s DB-polling). Runner writes DB + broadcasts. Store subscribes on mount, unsubscribes on unmount.
- Runner calls DB functions directly (same process, no IPC roundtrip)
- `jobs:create` IPC handler triggers `notifyNewJob()`; `jobs:cancel` handler calls `cancelRunningJob()`
- Race fix: `onJobStatusChange` handler only updates existing jobs, never adds — `create()` and `load()` are the canonical sources to avoid duplicates from broadcast arriving before invoke response

**Potential future work:**
- None identified — feature is complete

**After this:** Replace fixed-interval analysis with BPM-driven beat detection ([[project-bpm-analysis]]).

**Why:** The CLI proves the pipeline works but the app isn't usable without UI integration. This is the shortest path to a working desktop app.

**How to apply:** Feature is implemented. Next session should focus on BPM analysis or polish work.
