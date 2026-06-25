---
name: project-ui-wiring
description: Wire Electron UI to the mixing pipeline — next implementation task
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Wire the existing Electron UI (JobConfig + JobQueue) to `runMixPipeline` from `src/main/mixer/pipeline.ts`.

**Current state:** Pipeline works end-to-end via CLI (`pnpm mix`). UI components exist (JobConfig form, JobQueue with progress bars) but the "Start Mix" button only creates a DB record — nothing processes the job.

**What needs to happen:**
1. Add a job worker/runner in main process that picks up pending jobs and calls `runMixPipeline`
2. Forward `onProgress` callbacks to the renderer via IPC (or event-based push to replace polling)
3. Handle completion (update job status to `done`, set `outputPath`) and failure (set `error`)
4. Handle cancellation (AbortController per job, triggered from UI cancel button)
5. Respect `maxConcurrency` from `appState` — queue excess jobs

**Existing plumbing:**
- IPC handlers for all job state transitions already exist (`jobs:updateStatus`, `jobs:updateProgress`, `jobs:complete`, `jobs:fail`, `jobs:cancel`)
- Pinia store polls active jobs every 1000ms — progress updates will show automatically if DB is updated
- `PipelineOptions` already accepts `onProgress` and `AbortSignal`

**Key design question:** Whether to keep the polling model (pipeline updates DB, renderer polls) or switch to event push (main→renderer via `webContents.send`). Polling is simpler and already works; push is more responsive.

**After this:** Replace fixed-interval analysis with BPM-driven beat detection using essentia.js ([[project-bpm-analysis]]).

**Why:** The CLI proves the pipeline works but the app isn't usable without UI integration. This is the shortest path to a working desktop app.

**How to apply:** Plan this as a focused implementation session. Most of the infrastructure exists — it's primarily a wiring task connecting existing pieces.
