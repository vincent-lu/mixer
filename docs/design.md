# mixer — Design Document

Current-state specification. Updated alongside implementation.

## Stack

| Component | Version | Role |
|-----------|---------|------|
| Electron | 42.5 | Desktop shell |
| electron-vite | 5.0 | Three-process build (main/preload/renderer) |
| Vue 3 | 3.5 | UI framework (`<script setup>`, Composition API) |
| TypeScript | 6.0 | Strict mode + noUncheckedIndexedAccess |
| Pinia | 3.0 | State management |
| better-sqlite3 | 12.x | SQLite driver |
| Drizzle ORM | 0.45 | Schema, queries, migrations |
| essentia.js | 0.1.3 | Audio analysis (WASM, BPM/beat/onset detection) |
| FontAwesome | 7.2 | Icons (sharp-regular set) |
| Tailwind CSS | 4.3 | Styling (Vite plugin, no config file) |
| ffmpeg | system | Video processing (not bundled) |

## Architecture

Three-process Electron model with strict IPC boundary:

```
main process          preload           renderer
  ┌──────────┐    ┌────────────┐    ┌──────────────┐
  │ DB layer │    │ contextBridge│   │ Vue app      │
  │ IPC hdlrs│◄──►│ window.api │◄──►│ Platform intf│
  │ ffmpeg   │    └────────────┘    │ Pinia stores │
  └──────────┘                      │ Components   │
                                    │ essentia.js  │
                                    └──────────────┘
```

**Platform seam:** `src/renderer/src/platform/types.ts` defines the `Platform` interface. Electron implementation in `electron.ts` is a thin wrapper over `window.api`.

## Data Model

### jobs

Mixing job with full lifecycle tracking.

| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | autoincrement |
| name | text | auto-generated from BGM filename |
| status | text | `pending → analyzing → mixing → done/failed/cancelled` |
| config | JSON | `MixJobConfig` — BGM path, video paths, output settings |
| analysis_result | JSON | `AnalysisResult` — BPM, section timings, scene count |
| progress | integer | 0-100 |
| progress_stage | text | `normalizing`, `analyzing`, `mixing`, or `encoding` |
| error | text | populated on failure |
| output_path | text | final output file path |
| created_at | integer | unix-ms |
| started_at | integer | unix-ms, set on first status transition |
| completed_at | integer | unix-ms, set on done/failed/cancelled |

### presets

Saved job configurations for reuse.

| Column | Type | Notes |
|--------|------|-------|
| id | integer PK | autoincrement |
| name | text | user-defined |
| config | JSON | `MixJobConfig` |
| created_at | integer | unix-ms |
| updated_at | integer | unix-ms |

### app_state

Singleton row (id=1) for global settings.

| Column | Type | Default |
|--------|------|---------|
| max_concurrency | integer | 1 |
| default_output_dir | text | null |
| last_used_preset_id | integer FK | null |

## Job Lifecycle

```
pending → analyzing → mixing → done
                  ↘         ↘
                  failed    cancelled
```

- **pending**: created, waiting to start
- **analyzing**: BGM audio analysis in progress (essentia.js)
- **mixing**: ffmpeg processing (scene selection + concatenation + audio mix)
- **done**: output file written
- **failed**: error recorded, can be deleted
- **cancelled**: user-initiated abort

## Audio Analysis Pipeline

Uses essentia.js (WASM) running in the main process (`src/main/mixer/audio.ts`). PCM extracted via ffmpeg, then analyzed synchronously.

### Implemented

1. **Beat detection** (`BeatTrackerMultiFeature`) — finds beat positions and derives BPM from median inter-beat interval
2. **Beat selection** — filters beat ticks by configurable minimum gap (default 0.5s), producing scene switch timings. Retained as fallback when scored data is unavailable.
3. **Onset detection** (`SuperFluxExtractor`) — returns onset event times in seconds. Detects musical events (cymbal hits, note attacks, drops) independent of the beat grid. 1200-1300 events on real songs.
4. **Per-beat energy** (manual windowing + `RMS`) — 100ms window around each beat position, compute RMS. Gives energy level per beat. `BeatsLoudness` crashes in WASM; manual approach works and gives more control.
5. **Energy-based sections** (`detectSections`) — RMS curve at 0.5s hop / 1.0s window, classify as low/medium/high by thirds of the min-max range, merge consecutive same-level windows, filter sections shorter than 1.5s, consolidate adjacent same-energy sections. Returns single medium section when RMS range is below epsilon (0.01) to suppress noise on uniform-energy input (click tracks). Populates `AnalysisResult.sections`.
6. **Scored beat selection** (`scoreBeats` + `selectScoredBeats`) — composite score per beat: onset proximity ×0.4, energy level ×0.35, energy delta ×0.25. Within a [minGap, minGap+2s] window, pick the highest-scored beat instead of greedy first-past-gap. Populates `AnalysisResult.beats` and drives `sectionTimings`. Retained as fallback when `minSegmentDuration` is explicitly set (backward compat).
7. **Style-driven pacing** (`resolveMinGap` + `selectScoredBeatsBySection`) — `MixStyle` ('chill' | 'relaxed' | 'balanced' | 'energetic' | 'hyperkinetic') × section energy ('low' | 'medium' | 'high') maps to a concrete minGap via a 5×3 table (12.0s for chill/low down to 0.35s for hyperkinetic/high). `selectScoredBeatsBySection` uses each beat's section energy to resolve minGap locally — tight cuts during drops, wide gaps during breakdowns. Lookahead scales with minGap (`max(0.5s, minGap × 0.4)`). Default style is 'balanced' when `MixStyle` is absent. Explicit `minSegmentDuration` overrides style-driven pacing entirely.

Falls back to fixed-interval timing if beat detection fails. Onset/energy/section fields are absent in fallback mode.

### Planned (not yet designed in detail)

8. **Frequency band energy** (`EnergyBand`) — distinguish bass drops from hi-hat rolls. Bass energy drives cut timing; treble energy could influence transition speed.
9. **Bar/phrase awareness** — infer bar boundaries from BPM (groups of 4 beats). Prefer downbeats for cuts. In calmer styles, cut only on bar/phrase boundaries.
10. **Silence/drop detection** — detect near-silence moments (RMS below threshold for >0.3s). Special treatment: hold a single shot during silence, trigger cut at energy spike.

### Extension strategy

`AnalysisResult` uses optional fields — the mixing pipeline consumes whatever layers are available, falling back to simpler strategies when higher layers are absent. New analysis layers add fields without breaking the existing pipeline.

## ffmpeg Integration

System-installed ffmpeg, validated on startup (`src/main/ffmpeg/validate.ts`).

Planned usage:
- **Probe**: `ffprobe` for video metadata (duration, resolution, codec)
- **Scene detection**: `ffmpeg -filter:v "select='gt(scene,0.3)'"` for finding cut points in source videos
- **Mixing**: concat demuxer + audio replacement + re-encoding
- **Progress**: parse ffmpeg stderr for progress reporting

## Mixing Pipeline

CLI-first pipeline in `src/main/mixer/`, callable from both CLI (`pnpm mix`) and Electron IPC.

```
probe → normalize → analyze → plan segments → assign transitions → encode
```

| Module | Role |
|--------|------|
| `probe.ts` | ffprobe wrapper (video metadata, audio duration) |
| `audio.ts` | PCM extraction (ffmpeg) + essentia.js beat detection |
| `analyze.ts` | BGM timing analysis (beat detection default, fixed-interval fallback) |
| `segments.ts` | Shuffled round-robin segment assignment with cursor tracking |
| `transitions.ts` | Map musical context to transition types (cut/dissolve/flash) |
| `concat.ts` | Concat demuxer file builder + ffmpeg arg construction (hard cuts only) |
| `filter.ts` | filter_complex arg builder for mixes with transitions |
| `encode.ts` | Spawn ffmpeg, parse progress from stderr, abort support |
| `pipeline.ts` | Orchestrator — single async function, self-contained per invocation |

**Dual-path ffmpeg strategy:**
- **Concat demuxer** (fast path): when all transitions are hard cuts. `inpoint`/`outpoint` per segment, single ffmpeg command, no temp files.
- **filter_complex** (transition path): when dissolves or flash frames are assigned. One `-i` per segment with `-ss` seeking, `trim`+`setpts`+`settb=AVTB` per segment, grouped `concat` for consecutive hard cuts, `xfade` for dissolves, `fade`+`concat` for flash frames. Single ffmpeg command, single encoding pass.

Transition assignment is automatic — derived from `AnalysisResult.sections` and `.beats`. No user config needed. Graceful degradation: absent analysis data → all cuts → concat demuxer path.

**Transitions:**
- **Hard cut** (default) — most segment boundaries
- **Dissolve** (0.4s `xfade=transition=fade`) — segment boundary coinciding with a section energy change (e.g., verse→chorus)
- **Flash frame** (0.12s `fade=color=white`) — segment boundary at a high energy delta beat after a low-energy section (drop effect)

**CLI:** `pnpm mix --bgm <path> --videos <path...> --output <path> [--segment-duration <s> | --min-segment <s>] [--style <style>]`

## Job Runner

Main-process job runner in `src/main/runner.ts`. Bridges UI job creation to the mixing pipeline.

**Flow:** `jobs:create` IPC → `notifyNewJob()` → `processQueue()` → `executeJob()` → `runMixPipeline()`

**Concurrency:** FIFO queue respecting `maxConcurrency` from `appState` (default 1, range 1–8). When a job completes or fails, `processQueue()` re-checks for pending work.

**Progress:** Pipeline `onProgress` callback writes to DB (`updateJobProgress`) and broadcasts `job:progress` event via `webContents.send`. Status transitions broadcast full job via `job:status-change`. Pinia store subscribes to push events on mount — no polling. Status transitions tracked to avoid redundant DB writes.

**Cancellation:** `AbortController` per running job, stored in `Map<number, AbortController>`. Cancel from UI → `cancelRunningJob(id)` → `controller.abort()` → pipeline exits → catch handler marks job cancelled.

**Startup recovery:** Jobs stuck in `analyzing`/`mixing` from a prior crash are marked `failed`. Pending jobs are picked up automatically.

**Shutdown:** `stopRunner()` sets a `stopped` flag (prevents `processQueue` re-entry), aborts all controllers, clears the map.

## Video Preprocessing

Source videos are normalized to a common format before mixing. Ensures consistent resolution, framerate, and codec across all segments.

**Pipeline** (`src/main/mixer/normalize.ts`):
1. **Probe** — `probeVideo()` reads codec, resolution, framerate, duration (already done by pipeline)
2. **Match check** — `needsNormalization()` compares against target preset (default: h264, 1920x1080, 30fps). Videos already matching are skipped.
3. **Normalize** (if needed) — re-encode to target preset via ffmpeg. Scale with aspect ratio preservation + black padding. Audio streams preserved (`-c:a copy`).
4. **In-place replace** — write to temp file in same directory, atomic `rename()` over original. No cache directory or duplicate files.

**Local path requirement:** Normalization requires source videos on a local drive (`/Users/*` on macOS, drive letter on Windows). Network/external paths fail with a descriptive error — copy assets locally before mixing.

**Parallelization:** All videos normalize concurrently via `Promise.all`. Progress weighted by duration for accurate reporting.

**Progress stage:** Reports as `normalizing` (0–100%), mapped to `analyzing` job status. Stage is skipped entirely if all videos already match the preset.

## Scene Selection

Determines which source video clip plays during each audio-analyzed segment.

**Default: shuffled round-robin**
1. Create a deck of all source video indices
2. Shuffle the deck
3. Assign one segment per video in shuffled order
4. Repeat rounds until all segments are assigned
5. Anti-consecutive: reshuffle if last video of previous round equals first of current

Algorithm is pluggable (strategy pattern) — future options: weighted-by-duration, energy-matched, user-defined sequence.

## UI Layout

Two-panel layout, no router:

```
┌──────────────────────────┬────────────────┐
│   Job Configuration      │   Job Queue    │
│                          │                │
│  BGM: [Select file]      │  ┌──────────┐ │
│  Videos: [Add files]     │  │ Mix — X   │ │
│  Output: [Select folder] │  │ ■■■■░ 60% │ │
│  Format: [MP4 ▼]         │  └──────────┘ │
│  Resolution: [1080p ▼]   │  ┌──────────┐ │
│  Scene detect: [Random ▼]│  │ Mix — Y   │ │
│                          │  │ ✓ Done    │ │
│  [Start Mix]             │  └──────────┘ │
│                          │                │
│  (2/3 width)             │  (1/3 width)  │
└──────────────────────────┴────────────────┘
```

## Testing Strategy

Pure-logic tests only. No component mounting, no UI tests.

Test candidates (as features are built):
- Audio analysis result parsing
- ffmpeg command construction
- Job state machine transitions
- Scene selection algorithms

## Deferred

Not yet designed:
- Video-side analysis — motion energy profiling, source classification (raw footage vs pre-mixed), color/mood extraction. Lower priority; user manages video selection manually. Pre-mixed input videos need different treatment from long-scene footage.
- Preset save/load UI — closely related to mix style; presets would capture style + pacing + transition preferences alongside BGM/video/output settings
- Output preview
- Batch operations
