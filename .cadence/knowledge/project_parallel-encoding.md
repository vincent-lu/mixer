---
name: project-parallel-encoding
description: "Split single jobs into N parallel ffmpeg processes for faster encoding — idea, not yet scoped"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Split a single mixing job into N parallel ffmpeg chunks, each encoding a portion of the segment plan, then concat the parts with `-c copy`.

**Status:** Idea, not yet scoped.

**How it would work:**
1. Segment plan is already pre-computed (slices with inpoint/outpoint)
2. Split segment list into N chunks
3. Run N ffmpeg processes in parallel, each encoding its chunk (video only, no audio)
4. Concat the N partial videos + BGM audio into final output (`-c copy`, near-instant)

**Proposed UI:** "Split Each Job into N Parts" setting (default 2). Split parts consume concurrency slots — `maxConcurrency` remains the single cap on total parallel ffmpeg processes. A job with splitParts=2 uses 2 slots.

**Downsides:**
1. Concurrency math — splitParts × concurrent jobs must stay within maxConcurrency, or users accidentally spawn too many ffmpeg processes
2. Diminishing returns — CPU encoding is already multi-threaded; 2 parts is safe, 4+ may contend on lower core counts (e.g., 8C 7800X3D)
3. Temp file management — each part writes a temp file; cancellation/failure must clean up orphans
4. Progress aggregation — merge progress from N concurrent ffmpeg processes, weighted by chunk duration
5. Minor quality inconsistency at join points — each part's h264 encoder starts with fresh rate control state (barely noticeable with CRF)

**Why:** Significant speedup for single-job scenarios with long BGMs, especially on high-core-count CPUs (9950X3D, M4 Max).

**How to apply:** Scope as a dedicated session. Changes would touch pipeline.ts, encode.ts (or new parallel-encode module), and UI for the setting.
