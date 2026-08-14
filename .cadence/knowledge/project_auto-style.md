---
name: project-auto-style
description: Auto style resolution from BGM analysis (BPM × energy × user bias) — implemented
metadata:
  type: project
---

Automatic style, transition, and effect selection based on BGM audio analysis.

**Current state:** Implemented.

- `autoStyle` boolean + `intensityBias` number (0.5–2.0) on `MixJobConfig`
- `resolveAutoStyle()` in `src/main/mixer/auto-style.ts` — composite intensity score mapped to 7 style tiers
- Score = `normalize(BPM, 60–200) × energyMultiplier(sections) × intensityBias`, clamped 0–1
- Energy multiplier from duration-weighted section energy: 4 buckets (0.7/0.9/1.1/1.4×)
- Each tier bundles: mixStyle, lookahead, transitionEffect, transitionDensity, clipEffect, effectChance
- Pipeline recomputes sectionTimings after resolution via `selectScoredBeatsBySection` (fixes chicken-and-egg where analysis initially runs with default balanced style)
- NaN BPM guard defaults to 0
- UI checkbox hides creative controls, shows Intensity slider
- 14 unit tests

**Design decisions:**
- Boolean flag (`autoStyle`) rather than adding `'auto'` to `MixStyle` — keeps 7 concrete styles unchanged downstream
- Intensity bias slider as escape hatch — most music clusters 90–150 BPM, slider pushes into frenetic/chaos territory
- BPM-only wouldn't cover the full style spectrum; energy multiplier adds the missing dimension

**Watch items:**
- Mapping table values (BPM ranges, energy multipliers, tier bundles) are initial guesses — may need tuning after real-world usage
- `analyzeBgm` runs beat selection twice when autoStyle is on (once with balanced default, once with resolved style) — no perf concern but architecturally could be cleaner

**Why:** Manual style selection requires knowing the BGM's characteristics. Auto mode especially valuable in batch mode where each BGM is different.

**How to apply:** Feature is complete. See `docs/auto-style.md` for full algorithm spec. [[project-batch-mode]]
