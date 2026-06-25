# Decision Log

Append-only. Newest first.

---

## 2026-06-25 — Push-based progress replaces polling

**Decision:** Replace 1s DB-polling in Pinia store with push events from the runner via `webContents.send`. Two event types: `job:progress` (lightweight `{id, progress, stage}` for frequent updates) and `job:status-change` (full `MixJob` for infrequent state transitions). Runner broadcasts via `BrowserWindow.getAllWindows()`. Preload exposes `onJobProgress`/`onJobStatusChange` returning unsubscribe functions. Store subscribes on mount, unsubscribes on unmount.

**Why:** 1s polling added latency and unnecessary DB reads. Push events provide sub-second responsiveness and cleaner architecture. Two event types balance bandwidth (progress fires every percent) vs completeness (status changes carry full job data including error/outputPath/timestamps).

**Race condition fixed:** `executeJob` runs synchronously until its first `await`, so the initial `job:status-change` broadcast arrives at the renderer before the `jobs:create` invoke response. The `onJobStatusChange` handler must NOT add unknown jobs (only update existing) — `create()` and `load()` are the canonical sources for adding jobs to the array.

**Alternative considered:** Injecting `webContents` into the runner via `startRunner()` — rejected in favor of `BrowserWindow.getAllWindows()` which is simpler and decoupled.

---

## 2026-06-25 — Fix stale design.md audio analysis section

**Decision:** Updated "Audio Analysis Pipeline" section to reflect current reality: essentia.js runs in the main process (not renderer), uses `BeatTrackerMultiFeature` (not `PercivalBpmEstimator`), beat selection with configurable min gap is implemented (not just BPM detection). Fixed-interval fallback documented.

**Why:** Section was written at scaffold time and never updated through the BPM-driven beat detection implementation. Stale docs mislead future sessions.

---

## 2026-06-25 — BPM-driven beat detection

### essentia.js BeatTrackerMultiFeature in Node.js main process

**Decision:** Run beat detection in the main process using essentia.js CJS module (`createRequire` + `require('essentia.js')`). Extract PCM via ffmpeg (`-f f32le -ac 1 -ar 44100 pipe:1`), convert to Float32Array, feed to `BeatTrackerMultiFeature(signal, 208, 40)`. Filter raw beat ticks by configurable minimum gap with 20ms tolerance. BPM derived from median tick interval. Fixed-interval as fallback when beat detection fails or `segmentDuration` is explicitly set.

**Why:** Main process is where the pipeline runs — avoids IPC roundtrip to renderer for analysis. CJS entry pre-instantiates WASM module (no async factory needed). `BeatTrackerMultiFeature` provides both beat positions and confidence in one call.

**Beat selection strategy:** Greedy filter with minimum gap rather than "every Nth beat" or "cuts per bar." Minimum gap is intuitive (maps directly to visual pacing), adapts naturally to different tempos, and the existing `segmentDuration` parameter provides semantic precedent. 20ms tolerance accounts for essentia's hop-size-derived imprecision (~0.4992s intervals at 120 BPM instead of exactly 0.5s).

**Alternative considered:** Running essentia in renderer (existing `bpm.ts` pattern) — rejected because the mixing pipeline runs in main process and the CLI has no renderer. Separate `--min-segment` flag rather than overloading `--segment-duration` — clearer semantics, mutual exclusivity enforced.

---

## 2026-06-25 — Job runner: UI-to-pipeline wiring

### Main-process runner with DB-polling progress model

**Decision:** Add `src/main/runner.ts` as a module-level singleton (no class). Runner is event-driven — `notifyNewJob()` triggers queue check, no polling interval. `processQueue()` reads `maxConcurrency` from `appState`, picks oldest pending jobs (FIFO), fire-and-forgets `executeJob()`. Each job gets its own `AbortController` stored in a `Map<number, AbortController>`.

**Why:** Event-driven avoids wasteful polling in the runner. Module-level functions + Map is simpler than a class for what's effectively a singleton. FIFO ordering matches user expectation (first created, first processed).

**Progress model:** Runner writes progress to DB via `updateJobProgress()`; renderer's Pinia store polls every 1s. Kept the existing pull model rather than adding `webContents.send` push — simpler, already works, ~1s latency is acceptable for video processing that takes minutes.

**Cancellation:** `jobs:cancel` IPC handler calls `cancelRunningJob(id)` which aborts the controller for running jobs or directly updates DB for pending jobs. The pipeline's catch handler marks the DB as cancelled — single write, no double-update.

**Startup recovery:** `startRunner()` marks any jobs stuck in `analyzing`/`mixing` as `failed` (from prior crash), then processes pending queue.

**Alternative considered:** Push-based progress via `webContents.send` — deferred as optimization. Worker thread for the runner — unnecessary, pipeline is already async and JS single-threadedness simplifies concurrency reasoning.

---

## 2026-06-25 — MVP mixing pipeline implementation

### CLI-first pipeline with concat demuxer strategy

**Decision:** Build mixing pipeline as pure modules in `src/main/mixer/` (no Electron deps). CLI entry point via `pnpm mix` (tsx). ffmpeg concat demuxer with `inpoint`/`outpoint` per segment — single command, no temp video files, re-encodes output for frame-accurate cuts. Fixed-interval segmentation (default 4s) for MVP.

**Why:** Concat demuxer is simpler and more robust than complex filter_complex graphs. Re-encoding handles any input format without normalization. CLI-first enables testing without the Electron app. Same modules will be called from Electron IPC later.

---

## 2026-06-25 — Architecture refinements from reference project review

### Scene selection: shuffled round-robin with anti-consecutive constraint

**Decision:** Default to shuffled round-robin. Each round shuffles all source video indices, assigns one clip per video, repeats until all audio segments are filled. Reshuffle up to 5 times if last video of previous round equals first of current. Algorithm is pluggable (strategy pattern) for future alternatives.

**Why:** Ensures all videos get roughly equal screen time. Randomization prevents predictable patterns; round-robin prevents one video dominating. Validated approach from PMV_Generator reference but without the AI classification complexity.

**Alternative considered:** Pure random (can cluster on one video), weighted-by-duration (premature).

### Video preprocessing: probe-first, normalize only when needed

**Decision:** Before mixing, probe each source video via `ffprobe`. Compare codec, resolution, and framerate against a target preset (default: h264, 1080p, 30fps). Skip re-encoding if already matching. Cache normalized files for reuse across jobs.

**Why:** Source videos vary in age and format — normalization is required for clean concat. But many modern videos already match common presets, so probing first avoids unnecessary (expensive) re-encoding. Caching prevents redundant work across jobs.

### Audio analysis: start simple, design for extension

**Decision:** MVP uses BPM detection + beat tracking for switch-point identification. `AnalysisResult` type accommodates all planned layers (BPM, beats, onsets, sections, transition scores) as optional fields. Mixing pipeline uses whatever layers are available.

**Why:** BPM + beats provides sufficient scene switching for MVP. Richer analysis (energy-aware cut frequency, section-aware pacing) slots in incrementally without restructuring the pipeline or data model.

### Test assets: generated dummy videos and click-track BGMs

**Decision:** `scripts/generate-test-assets.mjs` creates 3 solid-color videos (blue 3min, red 4min, yellow 5min at 1080p) and 3 click-track BGMs (120/140/100 BPM). Output to `test-assets/` (gitignored). Run via `pnpm generate:test-assets`.

**Why:** Solid-color frames make mixed output verifiable by checking frame color at timestamps. Click tracks provide clean BPM detection targets. Different durations/BPMs exercise edge cases.

### Visual effects: ffmpeg xfade as starting point

**Decision:** Design the mixing pipeline so transitions are pluggable. Start with ffmpeg `xfade` filter (~30 built-in transition types). Evaluate quality before considering more complex approaches (custom shaders, per-frame rendering).

**Why:** xfade fits the "system ffmpeg" philosophy — no extra deps, moderate filter graph complexity. Going beyond (WebGL, shader-based) is orders of magnitude slower and a fundamentally different architecture. Better to prove the pipeline with xfade first.

---

## 2026-06-25 — Project scaffold decisions

### Beat detection: essentia.js with multi-layer analysis

**Decision:** Use essentia.js for all audio analysis. Start with BPM detection (PercivalBpmEstimator), then add beat tracking (BeatTrackerMultiFeature), onset detection (spectral flux), and structural segmentation.

**Why:** essentia.js is already proven in grid-player4 for BPM. It can do proper beat tracking and onset detection — musically aware, not just raw waveform amplitude like the PMV_Generator reference. Spectral flux-based onset detection is fundamentally more accurate than the PMV approach of moving-average energy thresholds.

**Alternative rejected:** Porting PMV_Generator's Python waveform analysis — crude, musically blind.

### Scene source selection: both random and ffmpeg, configurable per job

**Decision:** Default to random time ranges from source videos. Allow enabling ffmpeg scene detection (`select='gt(scene,threshold)'`) as a per-job toggle.

**Why:** Random is fast and good enough for most cases. ffmpeg scene detection produces higher-quality cuts but requires an initial scan pass per video. Making it configurable avoids forcing the slower path.

### UI scope: config panel + job queue

**Decision:** Two-panel layout. Left: job configuration form. Right: job queue with progress. No router — single-page with conditional rendering.

**Why:** Matches the PMV_Generator workflow (configure → run → monitor) without over-engineering. Grid-player4 also uses no router.

### ffmpeg: system-installed, not bundled

**Decision:** Require ffmpeg and ffprobe on PATH. Validate on startup, log version. Do not bundle ffmpeg-static.

**Why:** All target environments already have ffmpeg. Bundling adds ~80MB, complicates updates, and the user maintains their own ffmpeg builds.

### Stack: mirror grid-player4

**Decision:** Electron 42.5, Vue 3.5, TypeScript 6, Pinia 3, better-sqlite3 + Drizzle, Tailwind 4.3, FontAwesome 7.2. Same electron-vite build, same IPC bridge pattern, same DB patterns.

**Why:** Proven infrastructure. Same developer, same conventions, minimal ramp-up.
