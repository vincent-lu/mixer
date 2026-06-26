---
name: project-audio-analysis-design
description: Multi-layer audio analysis — Session A done (types, detectOnsets, computePerBeatEnergy). Sessions B–D remaining (scoring, style pacing, transitions).
metadata:
  type: project
---

Multi-layer audio analysis design, agreed 2026-06-26. Builds on [[project-bpm-analysis]] (beat detection, implemented).

**Current state:** Session A complete — foundation types and detection functions implemented. Not yet wired into the pipeline (Sessions B–D). All algorithms verified on 4 test tracks (click_120bpm, Girls' Day K-pop, Phut Hon EDM remix, Nebulossa Spanish pop).

**Session A (done):** Types (`BeatInfo`, `Section`, `MixStyle` union) + optional fields on `AnalysisResult`/`MixJobConfig` in `types.ts`. `detectOnsets()` and `computePerBeatEnergy()` in `audio.ts` with tests. Empty-frame guard on energy function. Onset test verifies seconds unit (upper-bound check).

**Three analysis layers:**
1. **Onset detection** — `detectOnsets()` implemented in `audio.ts`. `SuperFluxExtractor(signal)` → onset times in seconds. 1200-1300 events on real songs.
2. **Per-beat energy** — `computePerBeatEnergy()` implemented in `audio.ts`. Manual 100ms windowing + `e.RMS(frame)`. `BeatsLoudness` crashes in WASM; manual approach works.
3. **Energy sections** — not yet implemented. RMS curve at 0.5s intervals → low/medium/high classification → merged sections.

**Scored beat selection:** Not yet implemented. Composite score per beat (onset proximity 0.4, energy 0.35, energy delta 0.25). Within gap window, pick highest-scored beat.

**Style-driven pacing:** `MixStyle` type defined ('chill' | 'relaxed' | 'balanced' | 'energetic' | 'hyperkinetic'). Optional on `MixJobConfig`. Pacing logic not yet implemented.

**Transition types:** Not yet implemented. Hard cut (normal beats), dissolve (section boundaries), flash frame (drops after silence). Via ffmpeg xfade.

**Priority tiers:**
- Tier 1: Scored beat selection, style-driven pacing, transition types
- Tier 2: Frequency band energy (`EnergyBand`), bar/phrase awareness, silence detection
- Tier 3 (deferred): Video-side analysis, narrative structure

**Key finding:** Video analysis deferred — user manages video selection manually. Pre-mixed input videos would produce garbage from motion/scene analysis; raw footage vs pre-mixed distinction needed if implemented later.

**essentia.js decision:** Stay with essentia.js + manual workarounds. No new libraries. `BeatsLoudness` and `FrameGenerator` crash (WASM bugs, 0.1.3 is last version); manual alternatives are trivial.

**Why:** "Cuts that feel like a music video" — beat-synced cutting is the core value proposition. Scored selection + style pacing is the smallest change for the biggest quality jump.

**Remaining sessions:**
- **Session B:** Scoring pipeline — energy sections, composite beat scoring, wire into `analyzeBgm`, validate on test MP3s. Update `design.md` items 3-5 to "Implemented" when wired in.
- **Session C:** Style-driven pacing — `MixStyle` controls cut density and energy reactivity
- **Session D:** Transition types — ffmpeg xfade mapped to musical context

**How to apply:** Foundation in `audio.ts` (detection functions) and `types.ts` (types). Next work targets `analyze.ts` (scoring + style-aware selection). Details in `docs/design.md` Audio Analysis Pipeline section.
