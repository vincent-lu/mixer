---
name: project-bpm-analysis
description: Replace fixed-interval cuts with BPM-driven beat detection — queued after UI wiring
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Replace the fixed-interval segment timing in `src/main/mixer/analyze.ts` with musically-aware beat detection.

**Current state:** `analyzeBgm()` returns evenly-spaced `sectionTimings` (default every 4s). `AnalysisResult` type already has `bpm`, `sectionTimings`, `bgmDuration`, `sceneCount` fields — all optional layers can slot in.

**What needs to happen:**
1. Use essentia.js `BeatTrackerMultiFeature` to find beat positions (currently only `PercivalBpmEstimator` for BPM is implemented in `src/renderer/src/audio/bpm.ts`)
2. Decide where beat analysis runs — currently essentia.js is renderer-only (WASM + Web Audio API). For CLI, would need either Node.js essentia binding or ffmpeg-based audio extraction + essentia in Node.
3. Score beat positions as scene switch candidates (not every beat should be a cut)
4. Future: onset detection, section segmentation, energy-aware pacing

**Design constraint from user:** "Happy to start simple as long as the architecture allows more robust analysis in the future." The pluggable `AnalysisResult` type was designed for this.

**Depends on:** [[project-ui-wiring]] (user wants UI working first)

**Why:** Beat-synced cutting is the core value proposition — what distinguishes mixer from manual video editing.

**How to apply:** Plan after UI wiring is complete. The `analyze.ts` module is the only file that changes; the rest of the pipeline consumes `AnalysisResult` generically.
