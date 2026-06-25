---
name: project-bpm-analysis
description: BPM-driven beat detection — implemented via essentia.js BeatTrackerMultiFeature in Node.js
metadata: 
  node_type: memory
  type: project
---

Beat-synced scene switching using essentia.js `BeatTrackerMultiFeature` in the main process.

**Current state:** Implemented (commit `65ce14d`, 2026-06-25). `analyzeBgm()` in `src/main/mixer/analyze.ts` uses beat detection by default, fixed-interval as fallback. New `src/main/mixer/audio.ts` handles PCM extraction (ffmpeg) and beat detection (essentia.js CJS via `createRequire`). `selectBeats()` filters raw ticks by configurable minimum gap with 20ms tolerance for essentia's floating-point imprecision.

**Architecture:**
- `extractPcm()` — ffmpeg → mono f32le 44.1kHz → Float32Array
- `detectBeats()` — `new Essentia(EssentiaWASM)` from CJS entry, `BeatTrackerMultiFeature(signal, 208, 40)`, `vectorToArray()` to convert VectorFloat → JS array
- `selectBeats()` — greedy filter: accept ticks >= (minDuration - 0.02s) apart from last accepted
- BPM derived from median tick interval

**Modes:**
- Beat detection (default): `--min-segment` / UI input controls minimum gap (default 4s)
- Fixed-interval: `--segment-duration` forces evenly-spaced cuts, no essentia

**Lessons from implementation:**
- essentia.js CJS exports `{ Essentia, EssentiaWASM }` — must construct instance
- `BeatTrackerMultiFeature` returns `VectorFloat`, not JS array — needs `vectorToArray()`
- Beat intervals are ~0.4992s at 120 BPM, not exactly 0.5s — tolerance needed in comparisons

**Next steps:**
1. Onset detection — spectral flux for musical event detection (planned in design.md)
2. Section segmentation — identify verse/chorus/bridge boundaries
3. Transition scoring — score beat positions as scene switch candidates using energy + onset data

**Why:** Beat-synced cutting is the core value proposition — what distinguishes mixer from manual video editing.

**How to apply:** The `AnalysisResult` type is designed for incremental enrichment. Future analysis layers add optional fields; the pipeline uses whatever is available.
