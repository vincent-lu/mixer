---
name: project-audio-analysis-design
description: "Multi-layer audio analysis — all sessions complete (types, detection, scoring, style-driven pacing, transitions, clip effects, frenetic/chaos styles + configurable lookahead)."
metadata: 
  node_type: memory
  type: project
  originSessionId: a42cd70d-77fb-4636-a381-01a0e4582151
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
- `resolveMinGap(style, energy)` — 7×3 mapping table (12.0s chill/low → 0.12s chaos/high)
- `selectScoredBeatsBySection(beats, sections, style, bgmDuration, lookahead?)` — per-beat section lookup, per-style default lookahead (`DEFAULT_STYLE_LOOKAHEAD` in `shared/types.ts`), effective window `max(lookahead, minGap × 0.4)`, 0-lookahead greedy fast path, eligibility check for cross-section filtering
- `detectSections` fixed: MIN_RMS_RANGE epsilon (0.01) + same-energy consolidation pass for click track noise
- `analyzeBgm()` branches: explicit `minSegmentDuration` → fixed minGap (backward compat), otherwise → style-driven (default 'balanced')
- Wired through `PipelineOptions`, `runner.ts`, CLI `--style` flag
- Validation: chill ~12-30 segments, hyperkinetic ~96-249 for 2-3 min songs

**Session D (done, then overhauled twice):** Transition system — originally density/palette based, now density + single effect type:
- `assignTransitions(plan, analysis, density, effect, style)` in `transitions.ts` — worthiness scoring (section boundary 1.0, top-quartile beat 0.6, regular 0.2), top density% get transitions
- `TransitionEffect` type: 'cut' | 'circleopen' | 'fadewhite' | 'horzopen' | 'vertopen' | 'acid' | 'doublevision' | 'solarize' | 'strobe' | 'strobe_white'. One type per mix (no randomization). Custom transitions use `xfade=transition=custom:expr=...`
- Per-type fixed durations (0.6–1.2s base) scaled by MixStyle (chill ×1.5 → chaos ×0.2)
- Flash frames preserved as special case for extreme energy spikes (0.06s)
- Dual-path preserved: effect 'cut' or density 0 → concat demuxer (fast path); otherwise → filter_complex
- Old `TransitionPalette` (4 cumulative tiers) removed — replaced by explicit `TransitionEffect`

**Clip effects (done):** Per-segment visual effects in `effects.ts`:
- 11 effect types: shake, shake_hard, shake_blur, zoompulse, kenburns, drift, vignette_pulse, hueshift, flashpulse, negflash, chromatic
- `clipEffect` selects the type, `effectChance` (0–100%) determines per-segment probability (Math.random)
- Effects append ffmpeg filter chains after trim→setpts→settb. Chromatic uses multi-stream split/blend with unique labels per segment
- Effects compose independently with transitions. Presence of effects triggers filter_complex path (with padded all-cuts transitions if no transitions assigned)

**Frenetic/chaos styles + configurable lookahead (done):** Two faster mix styles added — `frenetic` (0.2–0.75s gaps, 0.1s lookahead) and `chaos` (0.12–0.35s gaps, 0.0s lookahead = greedy). Per-style default lookahead table (`DEFAULT_STYLE_LOOKAHEAD` in `shared/types.ts`, single source of truth): chill 1.0s → chaos 0.0s. At 0.0s, `selectScoredBeatsBySection` takes the first eligible beat with no window scanning. `lookahead` field on `MixJobConfig` + UI (auto-set per style, user can override) + CLI `--lookahead`. MixStyle `STYLE_DURATION_SCALE` extended for frenetic (×0.35) and chaos (×0.2).

**Post-sprint UI wiring (done, updated):** Mix Style dropdown (7 styles), Lookahead field (auto-set per style, editable), Transition Effect dropdown (10 types), Transition Density slider (hidden when Cut), Clip Effect dropdown (12 types), Effect Chance slider (hidden when None, defaults to 50% on first effect selection). CLI: `--transition-density N`, `--transition-effect <name>`, `--clip-effect <name>`, `--effect-chance N`, `--lookahead <s>`, `--no-transitions` as shorthand. BGM file picker accepts video files. Output dir persisted. Default concurrency 1.

**How to apply:** Detection in `audio.ts`, scoring + selection in `analyze.ts`, transitions in `transitions.ts`, effects in `effects.ts`, filter construction in `filter.ts`, types in `types.ts` + `types.ts` (mixer). Details in `docs/design.md` Audio Analysis Pipeline and Mixing Pipeline sections.
