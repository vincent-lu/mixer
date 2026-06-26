---
name: project-audio-analysis-design
description: Multi-layer audio analysis — Sessions A–C done (types, detection, scoring, style-driven pacing). Session D remaining (transitions).
metadata:
  type: project
---

Multi-layer audio analysis design, agreed 2026-06-26. Builds on [[project-bpm-analysis]] (beat detection, implemented).

**Current state:** Sessions A–C complete. Style-driven pacing is wired into `analyzeBgm()` — style × section energy determines cut density per beat. Validated on 5 test tracks across all 5 styles.

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

**Transition types:** Not yet implemented. Hard cut (normal beats), dissolve (section boundaries), flash frame (drops after silence). Via ffmpeg xfade.

**Remaining session:**
- **Session D:** Transition types — ffmpeg xfade mapped to musical context

**How to apply:** Detection in `audio.ts`, scoring + selection in `analyze.ts`, types in `types.ts`. Details in `docs/design.md` Audio Analysis Pipeline section.
