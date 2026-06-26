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

**Session D (done, then overhauled):** Transition system — density/palette based:
- `assignTransitions(plan, analysis, density, palette, style)` in `transitions.ts` — worthiness scoring (section boundary 1.0, top-quartile beat 0.6, regular 0.2), top density% get transitions
- `TransitionAssignment { type: string, duration: number }` replaces old `TransitionType` union
- 4 cumulative palettes: subtle (fades/dissolves), dynamic (+wipes/slides), cinematic (+reveals/zooms), aggressive (+glitch/pixelize)
- Per-type durations (0.4–1.2s base) scaled by MixStyle (chill ×1.5 → hyperkinetic ×0.5)
- Flash frames preserved as special case for extreme energy spikes (0.06s, not palette-driven)
- Section boundary tolerance widened 0.5s → 1.0s
- `buildFilterComplexArgs` accepts variable xfade types and durations per boundary
- Dual-path preserved: density 0 → concat demuxer (fast path), density >0 → filter_complex
- `enableTransitions` boolean removed from `MixJobConfig`, replaced by `transitionDensity` (0–100, default 30) + `transitionPalette` (default 'dynamic')
- Backward compat: old DB records with `enableTransitions: true` → density 30 + dynamic; `false` → density 0

**Post-sprint UI wiring (done, updated):** Mix Style dropdown (5 styles with inline hints), Transition Density slider (0–100%), Transition Style palette dropdown with hints, Min Segment Duration removed from UI. CLI: `--transition-density N`, `--transition-palette <name>`, `--no-transitions` as shorthand. BGM file picker accepts video files. Output dir persisted. Default concurrency 1.

**How to apply:** Detection in `audio.ts`, scoring + selection in `analyze.ts`, transitions in `transitions.ts`, filter construction in `filter.ts`, types in `types.ts` + `types.ts` (mixer). Details in `docs/design.md` Audio Analysis Pipeline and Mixing Pipeline sections.
