# Decision Log

Append-only. Newest first.

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
