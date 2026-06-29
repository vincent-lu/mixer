---
name: project-sar-edge-case
description: Non-square SAR videos may skip normalization and display at wrong aspect ratio — known edge case, not yet confirmed
metadata:
  type: project
---

Potential aspect ratio bug for videos with non-square pixels (SAR != 1:1).

**Current state:** Identified but unconfirmed. No concrete report yet.

**The issue:** `needsNormalization` in `src/main/mixer/normalize.ts:13-19` checks `codec`, `width`, `height`, `fps` — but not SAR. A video that's technically 1920x1080 h264@30fps but has non-square SAR (e.g. from certain cameras or transcoding tools) would pass the check and skip normalization. The `scale+pad` filter in `buildNormalizeArgs` would fix SAR if it ran, but it never gets invoked.

**Where to look:**
- `src/main/mixer/normalize.ts:13-19` — `needsNormalization()` gate (missing SAR check)
- `src/main/mixer/probe.ts:27-45` — `probeVideo()` doesn't extract SAR from ffprobe output
- `src/main/mixer/types.ts:10-16` — `ProbeResult` has no SAR field
- Commit `63d382e` — `setsar=1` fix in the effect chain handles SAR downstream, but only for videos that make it past normalization

**Fix when needed:** Add SAR to `ProbeResult`, extract it in `probeVideo`, check it in `needsNormalization`. The normalize filter already produces correct output (square pixels via scale+pad) — the gap is only in the skip-check.

**Why:** Non-16:9 videos are correctly letterboxed. The risk is specifically 1920x1080 videos with anamorphic pixels — they look 16:9 on paper but display wider/narrower.
