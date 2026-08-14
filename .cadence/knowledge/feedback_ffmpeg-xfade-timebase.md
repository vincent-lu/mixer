---
name: feedback-ffmpeg-xfade-timebase
description: ffmpeg xfade requires matching timebases — use settb=AVTB on all trimmed segments in filter_complex
metadata:
  type: feedback
---

ffmpeg's `xfade` filter fails with "timebase do not match" when chaining concat and xfade operations in a filter_complex. The concat filter output inherits the source video's timebase (e.g., 1/15360), which may differ from the accumulated chain's timebase (1/1000000).

**Why:** Discovered during Session D validation — the filter_complex worked in isolation tests but failed on real song mixes with 80+ segments because the accumulated chain went through enough concat/xfade operations for the timebase divergence to surface.

**How to apply:** Always add `settb=AVTB` to each trimmed segment in any filter_complex that chains xfade with concat:
```
[i:v]trim=duration=X,setpts=PTS-STARTPTS,settb=AVTB[vi]
```
AVTB normalizes to 1/AV_TIME_BASE (1/1000000), ensuring all streams entering xfade/concat have matching timebases.
