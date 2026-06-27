# Auto Style

Automatic style resolution based on BGM analysis. When `autoStyle` is enabled, the pipeline determines mix style, transitions, and effects from the BGM's BPM and energy profile instead of using manually configured values.

## Composite intensity score

```
intensity = clamp(normalize(BPM) × energyMultiplier × intensityBias, 0, 1)
```

### BPM normalization

Linear mapping from BPM to 0–1:

```
bpmScore = clamp((bpm - 60) / 140, 0, 1)
```

60 BPM → 0.0, 130 BPM → 0.5, 200 BPM → 1.0.

### Energy multiplier

Computed from analysis sections. Each section's energy level (low/medium/high) is weighted by its duration as a fraction of total BGM length.

```
weightedEnergy = Σ(sectionDuration × energyValue) / totalDuration
```

Where `energyValue`: low = 0, medium = 0.5, high = 1.0.

| Weighted energy | Multiplier |
|----------------|------------|
| 0.00–0.25 | 0.70 |
| 0.25–0.50 | 0.90 |
| 0.50–0.75 | 1.10 |
| 0.75–1.00 | 1.40 |

### Intensity bias (user slider)

Continuous slider from 0.5 to 2.0, default 1.0. Stored as `intensityBias` on `MixJobConfig`. Allows the user to push results toward calmer or more intense styles regardless of what the analysis produces.

## Score-to-style mapping

| Score range | Style | Transition | Density | Clip Effect | Effect % |
|-------------|-------|------------|---------|-------------|----------|
| 0.00–0.14 | chill | fadewhite | 15% | kenburns | 30% |
| 0.15–0.28 | relaxed | fadewhite | 20% | drift | 25% |
| 0.29–0.42 | balanced | circleopen | 30% | none | 0% |
| 0.43–0.57 | energetic | horzopen | 40% | zoompulse | 35% |
| 0.58–0.71 | hyperkinetic | acid | 50% | shake | 45% |
| 0.72–0.85 | frenetic | strobe | 60% | shake_hard | 55% |
| 0.86–1.00 | chaos | strobe_white | 70% | chromatic | 65% |

Lookahead is derived from the resolved style via `DEFAULT_STYLE_LOOKAHEAD`.

## Examples

| Track type | BPM | Energy | Bias | Score | Style |
|------------|-----|--------|------|-------|-------|
| Ambient | 80 | low (0.7×) | 1.0 | 0.10 | chill |
| Pop | 120 | medium (1.1×) | 1.0 | 0.47 | energetic |
| Pop | 120 | high (1.4×) | 1.0 | 0.60 | hyperkinetic |
| Pop | 120 | medium (1.1×) | 1.6 | 0.75 | frenetic |
| EDM | 140 | high (1.4×) | 1.0 | 0.80 | frenetic |
| EDM | 140 | medium (1.1×) | 2.0 | clamped | chaos |

## Config fields

```typescript
interface MixJobConfig {
  // ...existing fields...
  autoStyle?: boolean       // when true, pipeline resolves style from analysis
  intensityBias?: number    // 0.5–2.0, default 1.0, only used when autoStyle is true
}
```

When `autoStyle` is true, the following config fields are ignored: `mixStyle`, `lookahead`, `transitionEffect`, `transitionDensity`, `clipEffect`, `effectChance`.

## Pipeline integration

Resolution happens after audio analysis, before segment planning:

```
probe → normalize → analyze → [resolveAutoStyle] → plan segments → assign transitions → assign effects → encode
```

The resolved values are used in place of the config values for all downstream steps. The original config is not mutated.

## UI behavior

When auto style is toggled on in the job config:
- Hide: mix style, lookahead, transition effect/density, clip effect/chance
- Show: intensity bias slider (0.5–2.0, labeled "Calmer ← → More intense")
- Output format, video resolution, scene detection remain visible
