---
name: project-audio-analysis-design
description: Designed multi-layer audio analysis — onsets, energy, sections, scored beats, style-driven pacing. Tested on real songs. Not yet implemented.
metadata:
  type: project
---

Multi-layer audio analysis design, agreed 2026-06-26. Builds on [[project-bpm-analysis]] (beat detection, implemented).

**Current state:** Designed and tested via prototype scripts. Not yet integrated into the pipeline. All algorithms verified on 4 test tracks (click_120bpm, Girls' Day K-pop, Phut Hon EDM remix, Nebulossa Spanish pop).

**Three new analysis layers:**
1. **Onset detection** — `SuperFluxExtractor(signal)` → onset times in seconds. 1200-1300 events on real songs.
2. **Per-beat energy** — manual 100ms windowing + `e.RMS(frame)`. `BeatsLoudness` crashes in WASM; manual approach works.
3. **Energy sections** — RMS curve at 0.5s intervals → low/medium/high classification → merged sections. Correctly finds verse/chorus/bridge by energy.

**Scored beat selection:** Composite score per beat (onset proximity 0.4, energy 0.35, energy delta 0.25). Within gap window, pick highest-scored beat. Tested: consistently shifts cuts to section transitions and drop entries.

**Style-driven pacing:** Mix style parameter in `MixJobConfig` (part of preset system). Spectrum from near-playthrough to hyperkinetic. Energy sections modulate base pacing per style.

**Transition types:** Hard cut (normal beats), dissolve (section boundaries), flash frame (drops after silence). Via ffmpeg xfade. Style also influences transition mix.

**Priority tiers:**
- Tier 1: Scored beat selection, style-driven pacing, transition types
- Tier 2: Frequency band energy (`EnergyBand`), bar/phrase awareness, silence detection
- Tier 3 (deferred): Video-side analysis, narrative structure

**Key finding:** Video analysis deferred — user manages video selection manually. Pre-mixed input videos would produce garbage from motion/scene analysis; raw footage vs pre-mixed distinction needed if implemented later.

**essentia.js decision:** Stay with essentia.js + manual workarounds. No new libraries. `BeatsLoudness` and `FrameGenerator` crash (WASM bugs, 0.1.3 is last version); manual alternatives are trivial.

**Why:** "Cuts that feel like a music video" — beat-synced cutting is the core value proposition. Scored selection + style pacing is the smallest change for the biggest quality jump.

**How to apply:** Implementation sprint targets `audio.ts` (new detection functions), `analyze.ts` (scoring + style-aware selection), `types.ts` (AnalysisResult extension). Details in `docs/design.md` Audio Analysis Pipeline section.
