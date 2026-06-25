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
| progress_stage | text | `analyzing`, `mixing`, or `encoding` |
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
| max_concurrency | integer | 2 |
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

1. **Beat detection** (`BeatTrackerMultiFeature`) — finds beat positions and derives BPM from median inter-beat interval
2. **Beat selection** — filters beat ticks by configurable minimum gap (default 0.5s), producing scene switch timings
3. **Onset detection** (planned: spectral flux) — detects musical events
4. **Section segmentation** (planned) — identifies structural boundaries (verse/chorus/bridge)
5. **Transition scoring** (planned) — scores beat positions as scene switch candidates

Currently implemented: beat detection + beat selection. Falls back to fixed-interval timing if beat detection fails.

`AnalysisResult` is designed with all layers as optional fields — the mixing pipeline uses whatever is available, falling back to simpler strategies (e.g., fixed-interval timing) when higher layers are absent. This allows incremental analysis improvements without restructuring the pipeline.

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
probe → analyze → plan segments → concat + encode
```

| Module | Role |
|--------|------|
| `probe.ts` | ffprobe wrapper (video metadata, audio duration) |
| `audio.ts` | PCM extraction (ffmpeg) + essentia.js beat detection |
| `analyze.ts` | BGM timing analysis (beat detection default, fixed-interval fallback) |
| `segments.ts` | Shuffled round-robin segment assignment with cursor tracking |
| `concat.ts` | Concat demuxer file builder + ffmpeg arg construction |
| `encode.ts` | Spawn ffmpeg, parse progress from stderr, abort support |
| `pipeline.ts` | Orchestrator — single async function, self-contained per invocation |

**ffmpeg strategy:** concat demuxer with `inpoint`/`outpoint` per segment. Single ffmpeg command, no temp video files. Re-encodes output (frame-accurate cuts, handles any input format). Progress parsed from stderr `time=` field.

**CLI:** `pnpm mix --bgm <path> --videos <path...> --output <path> [--segment-duration <s> | --min-segment <s>]`

## Job Runner

Main-process job runner in `src/main/runner.ts`. Bridges UI job creation to the mixing pipeline.

**Flow:** `jobs:create` IPC → `notifyNewJob()` → `processQueue()` → `executeJob()` → `runMixPipeline()`

**Concurrency:** FIFO queue respecting `maxConcurrency` from `appState` (default 2, range 1–8). When a job completes or fails, `processQueue()` re-checks for pending work.

**Progress:** Pipeline `onProgress` callback writes to DB (`updateJobProgress`) and broadcasts `job:progress` event via `webContents.send`. Status transitions broadcast full job via `job:status-change`. Pinia store subscribes to push events on mount — no polling. Status transitions tracked to avoid redundant DB writes.

**Cancellation:** `AbortController` per running job, stored in `Map<number, AbortController>`. Cancel from UI → `cancelRunningJob(id)` → `controller.abort()` → pipeline exits → catch handler marks job cancelled.

**Startup recovery:** Jobs stuck in `analyzing`/`mixing` from a prior crash are marked `failed`. Pending jobs are picked up automatically.

**Shutdown:** `stopRunner()` sets a `stopped` flag (prevents `processQueue` re-entry), aborts all controllers, clears the map.

## Video Preprocessing

Source videos are normalized to a common format before mixing. Ensures the concat pipeline works cleanly regardless of input codec/resolution variety.

**Pipeline:**
1. **Probe** — `ffprobe` reads codec, resolution, framerate, duration
2. **Match check** — compare against target preset (default: h264, 1080p, 30fps)
3. **Normalize** (if needed) — re-encode to target preset; skip if already matching
4. **Cache** — normalized files stored alongside originals, reused across jobs

Normalization runs per source video and parallelizes naturally across videos.

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

Designed, not yet implemented:
- Video preprocessing pipeline (probe + conditional normalization)
- Visual effects / transitions (ffmpeg xfade as starting point)

Not yet designed:
- Multi-layer audio analysis (onset + segmentation)
- ffmpeg scene detection integration
- Preset save/load UI
- Output preview
- Batch operations
