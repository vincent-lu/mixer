---
name: project-audio-analysis-design
description: Multi-layer audio analysis — all 4 sessions complete (types, detection, scoring, style-driven pacing, transitions).
metadata:
  type: project
---

Multi-layer audio analysis design, agreed 2026-06-26. Builds on [[project-bpm-analysis]] (beat detection, implemented).

**Current state:** All 4 sessions complete. The full pipeline: beat detection → onset detection → energy analysis → section detection → scored beat selection → style-driven pacing → transition assignment → dual-path encoding (concat demuxer or filter_complex).

**Session A (done):** Types (`BeatInfo`, `Section`, `MixStyle` union) + optional fields on `AnalysisResult`/`MixJobConfig` in `types.ts`. `detectOnsets()` and `computePerBeatEnergy()` in `audio.ts` with tests.

**Session B (done):** Scoring pipeline in `analyze.ts`:
- `detectSections(pcm, bgmDuration)` — RMS windowing (0.5s hop, 1.0s window), low/medium/high classification by thirds, merge short sections (< 1.5s)
- `scoreBeats(ticks, onsets, beatEnergy)` — composite score: onset proximity ×0.4, energy ×0.35, energy delta ×0.25. Defensive sorted-onset handling.
- `selectScoredBeats(beats, minGap, bgmDuration)` — picks highest-scored beat in [minGap, minGap+2s] window
- `analyzeBgm()` wired: calls all scoring functions, populates optional AnalysisResult fields
- Validation results: real songs get 14-16% fewer cuts than greedy, placed at musically stronger beats

**Session C (done):** Style-driven pacing in `analyze.ts`:
- `resolveMinGap(style, energy)` — 5×3 mapping table (12.0s chill/low → 0.35s hyperkinetic/high)
- `selectScoredBeatsBySection(beats, sections, style, bgmDuration)` — per-beat section lookup, scaled lookahead (`max(0.5s, minGap × 0.4)`), eligibility check in lookahead for cross-section filtering
- `detectSections` fixed: MIN_RMS_RANGE epsilon (0.01) + same-energy consolidation pass for click track noise
- `analyzeBgm()` branches: explicit `minSegmentDuration` → fixed minGap (backward compat), otherwise → style-driven (default 'balanced')
- Wired through `PipelineOptions`, `runner.ts`, CLI `--style` flag
- Validation: chill ~12-30 segments, hyperkinetic ~96-249 for 2-3 min songs

**Session D (done):** Transition types — ffmpeg xfade mapped to musical context:
- `assignTransitions(plan, analysis)` in `transitions.ts` — maps section boundaries and beat energy to `TransitionType` ('cut' | 'dissolve' | 'flash')
- `buildFilterComplexArgs(plan, transitions, bgmPath, outputPath)` in `filter.ts` — builds filter_complex with grouped concat, xfade for dissolves, fade+concat for flash frames
- Dual-path in `pipeline.ts`: all cuts → concat demuxer (fast path), any transitions → filter_complex (single-pass encoding)
- `settb=AVTB` on each trimmed segment prevents xfade timebase mismatch
- Dissolve outgoing segments extended by 0.4s for overlap content; net output duration matches BGM exactly
- Validation: Girls' Day track → 84 segments (75 cuts, 7 dissolves, 1 flash), 193.19s output matching BGM; click track → all cuts, concat path

**How to apply:** Detection in `audio.ts`, scoring + selection in `analyze.ts`, transitions in `transitions.ts`, filter construction in `filter.ts`, types in `types.ts` + `types.ts` (mixer). Details in `docs/design.md` Audio Analysis Pipeline and Mixing Pipeline sections.
