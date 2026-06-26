# mixer

Beat-synced video mixer. Takes source videos + BGM, analyzes the BGM for optimal scene switch timings using audio analysis (BPM, onsets, energy), and mixes into a new video with musically intelligent cuts, transitions, and clip effects.

Electron desktop app + CLI. System ffmpeg required.

## Quick Start

```bash
pnpm install
pnpm setup:essentia    # restore essentia.js WASM runtime
pnpm dev               # launch Electron app with HMR
```

## CLI

```bash
pnpm mix --bgm <path> --videos <path1> [path2...] --output <path> [options]
```

### Required arguments

| Argument | Description |
|---|---|
| `--bgm <path>` | Background music file (mp3, wav, flac, aac, ogg, m4a, wma) or video file (mp4, mkv, mov, avi, webm — audio track extracted automatically) |
| `--videos <path...>` | One or more source video files. Space-separated, terminated by the next `--` flag |
| `--output <path>` | Output file path |

### Mix style

| Argument | Description | Default |
|---|---|---|
| `--style <name>` | Controls cut frequency and how it reacts to musical energy. See [Mix Styles](#mix-styles) | `balanced` |
| `--lookahead <seconds>` | How far ahead (in seconds) the algorithm looks past the minimum gap to find a higher-scored beat. Lower = more cuts. `0` = take the first eligible beat (greedy). Each style has a default; this overrides it | Per-style default |

### Transitions

| Argument | Description | Default |
|---|---|---|
| `--transition-effect <name>` | Which transition effect to use at switch points. See [Transition Effects](#transition-effects) | `cut` |
| `--transition-density <0-100>` | Percentage of switch points that get the transition (vs hard cut). Higher = more transitions | `30` |
| `--no-transitions` | Shorthand for `--transition-density 0` | |

### Clip effects

| Argument | Description | Default |
|---|---|---|
| `--clip-effect <name>` | Visual effect applied to video segments. See [Clip Effects](#clip-effects) | `none` |
| `--effect-chance <0-100>` | Percentage chance each segment gets the effect applied | `0` |

### Segment duration overrides

| Argument | Description |
|---|---|
| `--segment-duration <seconds>` | Fixed-interval mode: evenly-spaced cuts, no beat detection. Mutually exclusive with `--min-segment` |
| `--min-segment <seconds>` | Override style-driven pacing with a fixed minimum gap. Mutually exclusive with `--segment-duration` |

### Examples

```bash
# Basic mix with default settings (balanced style, no transitions, no effects)
pnpm mix --bgm song.mp3 --videos clip1.mp4 clip2.mp4 --output mix.mp4

# EDM-style fast cuts with strobe transitions
pnpm mix --bgm edm_track.mp3 --videos v1.mp4 v2.mp4 v3.mp4 --output edm_mix.mp4 \
  --style hyperkinetic --transition-effect strobe --transition-density 40

# Chill mix with dissolves and shake effect
pnpm mix --bgm ambient.mp3 --videos landscape1.mp4 landscape2.mp4 --output chill.mp4 \
  --style chill --transition-effect fadewhite --transition-density 50 \
  --clip-effect shake --effect-chance 30

# Maximum chaos
pnpm mix --bgm hardcore.mp3 --videos v1.mp4 v2.mp4 v3.mp4 --output chaos.mp4 \
  --style chaos --clip-effect negflash --effect-chance 80

# Fixed 2-second segments, no audio analysis
pnpm mix --bgm song.mp3 --videos clip1.mp4 --output fixed.mp4 --segment-duration 2
```

## GUI (Electron App)

The desktop app provides the same controls as the CLI:

| Control | Description |
|---|---|
| **Background Music** | File picker — accepts audio and video files |
| **Source Videos** | Add/remove video files for the mix |
| **Output Directory** | Folder picker — persisted across app launches |
| **Output Filename** | Auto-generated from BGM name, editable |
| **Output Format** | MP4, MKV, or MOV |
| **Video Resolution** | 1080p, 720p, 480p, or Source |
| **Scene Detection** | Random segments or FFmpeg scene detection |
| **Mix Style** | Dropdown with cut frequency hint — see [Mix Styles](#mix-styles) |
| **Lookahead** | Auto-set per style, editable override (seconds) |
| **Transition Effect** | Dropdown — see [Transition Effects](#transition-effects) |
| **Transition Density** | Slider 0-100% (hidden when effect is Cut) |
| **Clip Effect** | Dropdown — see [Clip Effects](#clip-effects) |
| **Effect Chance** | Slider 0-100% (hidden when effect is None, auto-set to 50% on first selection) |
| **Max Concurrent Jobs** | Number of jobs to process simultaneously (default 1) |

## Mix Styles

Controls the minimum gap between scene switches, modulated by the BGM's energy sections (verse = wider gaps, chorus/drops = tighter gaps).

| Style | Low energy | Medium energy | High energy | Default lookahead | Character |
|---|---|---|---|---|---|
| `chill` | 12.0s | 8.0s | 5.0s | 1.0s | Long, lingering shots |
| `relaxed` | 9.0s | 5.0s | 3.5s | 0.8s | Gentle pacing |
| `balanced` | 5.0s | 3.0s | 1.5s | 0.5s | Follows the music |
| `energetic` | 3.0s | 1.5s | 0.75s | 0.3s | Fast, energy-reactive |
| `hyperkinetic` | 1.5s | 0.75s | 0.35s | 0.2s | Rapid-fire, sub-second drops |
| `frenetic` | 0.75s | 0.35s | 0.2s | 0.1s | Near-greedy, sub-beat everywhere |
| `chaos` | 0.35s | 0.2s | 0.12s | 0.0s | Every beat, no scoring |

**Lookahead** controls how selective the algorithm is. Higher values mean it waits longer to find a "better" beat to cut on (fewer but better-placed cuts). Lower values mean it cuts as soon as possible (more cuts). At 0.0s, every beat past the minimum gap is taken — maximum cut frequency.

## Transition Effects

Applied at switch points between clips. One type per mix, `transitionDensity` controls what percentage of switches use it (the rest are hard cuts).

### Built-in (ffmpeg xfade)

| Name | Description |
|---|---|
| `cut` | Instant switch (no transition) |
| `circleopen` | Circle expanding from center reveals next clip |
| `fadewhite` | Fade through white |
| `horzopen` | Horizontal split opening from center |
| `vertopen` | Vertical split opening from center |

### Custom effects

| Name | Description |
|---|---|
| `acid` | Interference pattern blend with color distortion |
| `doublevision` | Both clips visible simultaneously, blend oscillates |
| `solarize` | Color inversion peaks at midpoint |
| `strobe` | Rapid black flash alternation between clips |
| `strobe_white` | Rapid white flash alternation between clips |

Transition durations are set per type and scaled by mix style (chill = longer transitions, hyperkinetic = shorter).

## Clip Effects

Visual effects applied to individual video segments. One effect type per mix, `effectChance` controls the probability each segment gets it.

| Name | Description |
|---|---|
| `none` | No effect |
| `shake` | Gentle oscillating rotation (15% zoom, 2.3deg at 8Hz) |
| `shake_hard` | Aggressive shake (25% zoom, 4.6deg at 12Hz) |
| `shake_blur` | Shake with motion blur that pulses with the rotation |
| `zoompulse` | Rhythmic zoom in/out (~6Hz) |
| `kenburns` | Slow continuous zoom in (capped at 1.2x) |
| `drift` | Oscillating horizontal pan across overscanned frame |
| `vignette_pulse` | Dark edges that pulse in/out |
| `hueshift` | Color rotation at 90 degrees/sec |
| `flashpulse` | Periodic brightness spikes |
| `negflash` | Brief color inversion pulses |
| `chromatic` | RGB channel oscillation (chromatic aberration) |

## Audio Analysis Pipeline

The mixer analyzes the BGM to make musically intelligent decisions:

1. **Beat detection** — essentia.js `BeatTrackerMultiFeature` finds beat positions and derives BPM
2. **Onset detection** — `SuperFluxExtractor` detects musical events (cymbal hits, drops, note attacks)
3. **Per-beat energy** — RMS energy at each beat position
4. **Energy sections** — classifies the song into low/medium/high energy sections (verse, chorus, bridge)
5. **Beat scoring** — composite score per beat: onset proximity (0.4), energy level (0.35), energy delta (0.25)
6. **Style-driven selection** — selects switch points based on scores, section energy, and mix style

Falls back to fixed-interval timing if beat detection fails.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **ffmpeg** and **ffprobe** on PATH (system-installed, not bundled)

## Commands

```bash
pnpm dev                      # Dev server with HMR (Electron + Vite)
pnpm build                    # Production build
pnpm mix                      # CLI mixer (see above)
pnpm typecheck                # TypeScript checking (node + web configs)
pnpm test                     # Run tests (Vitest)
pnpm test:watch               # Tests in watch mode
pnpm setup:essentia           # Restore essentia.js WASM runtime
pnpm db:generate              # Generate Drizzle migration from schema
```

## Architecture

```
main process          preload           renderer
  +-----------+    +-------------+    +---------------+
  | DB layer  |    | contextBridge|   | Vue 3 app     |
  | IPC hdlrs |<-->| window.api  |<-->| Pinia stores  |
  | ffmpeg    |    +-------------+    | Components    |
  | mixer     |                       +---------------+
  +-----------+
```

| Layer | Code | Role |
|---|---|---|
| Data | `src/main/db/` | SQLite via better-sqlite3 + Drizzle ORM |
| Mixer | `src/main/mixer/` | Pipeline: probe, analyze, plan, transitions, effects, encode |
| Jobs | `src/main/runner.ts` | Job queue with concurrency, progress, cancellation |
| Analysis | `src/main/mixer/audio.ts`, `analyze.ts` | essentia.js BPM/onset/energy, scored beat selection |
| Transitions | `src/main/mixer/transitions.ts`, `filter.ts` | Transition assignment + ffmpeg filter_complex construction |
| Effects | `src/main/mixer/effects.ts` | Clip effect filter chains |
| UI | `src/renderer/src/` | Vue 3 + Pinia + Tailwind |
