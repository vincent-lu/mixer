---
name: project-audio-analysis-design
description: Multi-layer audio analysis — Sessions A–B done (types, detection, scoring pipeline wired). Sessions C–D remaining (style pacing, transitions).
metadata:
  type: project
---

Multi-layer audio analysis design, agreed 2026-06-26. Builds on [[project-bpm-analysis]] (beat detection, implemented).

**Current state:** Sessions A–B complete. Scoring pipeline is wired into `analyzeBgm()` — the full path (onset detection → per-beat energy → composite scoring → scored beat selection → energy section detection) runs on every BGM analysis. `AnalysisResult` now populates `beats`, `onsets`, and `sections`. Validated on 4 test tracks.

**Session A (done):** Types (`BeatInfo`, `Section`, `MixStyle` union) + optional fields on `AnalysisResult`/`MixJobConfig` in `types.ts`. `detectOnsets()` and `computePerBeatEnergy()` in `audio.ts` with tests.

**Session B (done):** Scoring pipeline in `analyze.ts`:
- `detectSections(pcm, bgmDuration)` — RMS windowing (0.5s hop, 1.0s window), low/medium/high classification by thirds, merge short sections (< 1.5s)
- `scoreBeats(ticks, onsets, beatEnergy)` — composite score: onset proximity ×0.4, energy ×0.35, energy delta ×0.25. Defensive sorted-onset handling.
- `selectScoredBeats(beats, minGap, bgmDuration)` — picks highest-scored beat in [minGap, minGap+2s] window
- `analyzeBgm()` wired: calls all scoring functions, populates optional AnalysisResult fields, uses `selectScoredBeats` as primary (greedy `selectBeats` retained as exported fallback)
- Validation results: real songs get 14-16% fewer cuts than greedy, placed at musically stronger beats

**Style-driven pacing:** `MixStyle` type defined ('chill' | 'relaxed' | 'balanced' | 'energetic' | 'hyperkinetic'). Optional on `MixJobConfig`. Pacing logic not yet implemented.

**Transition types:** Not yet implemented. Hard cut (normal beats), dissolve (section boundaries), flash frame (drops after silence). Via ffmpeg xfade.

**Remaining sessions:**
- **Session C:** Style-driven pacing — `MixStyle` controls cut density and energy reactivity
- **Session D:** Transition types — ffmpeg xfade mapped to musical context

**How to apply:** Detection in `audio.ts`, scoring + selection in `analyze.ts`, types in `types.ts`. Details in `docs/design.md` Audio Analysis Pipeline section.
