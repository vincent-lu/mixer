# Decision Log

Append-only. Newest first.

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
