---
name: project-sar-edge-case
description: Resolved — SAR, pixFmt, and fastStart now detected in normalization pipeline
metadata:
  type: project
---

Non-square SAR, non-yuv420p pixel format, and missing faststart are now detected and fixed by the normalization pipeline.

**Current state:** Resolved.

**What was implemented:**
- `ProbeResult` extended with `pixFmt`, `sar`, `fastStart`
- `probeVideo` extracts `pix_fmt` and `sample_aspect_ratio` from ffprobe; `checkFastStart` reads MP4 atom structure to detect moov position
- SAR `0:1` (ffprobe's "unspecified") coerced to `1:1` at probe time to avoid false positives
- `needsNormalization` checks `pixFmt !== preset.pixFmt`, `sar !== '1:1'`, `!fastStart`
- `buildNormalizeArgs` adds `setsar=1` to filter chain and `-movflags +faststart`
- Both the pre-normalize tool and the mixer pipeline benefit (shared code)

**Why:** Videos matching codec/resolution/fps but having non-square pixels, wrong pixel format, or slow-start moov placement would skip normalization and cause playback issues.
