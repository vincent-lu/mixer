---
name: project-reference-pmv-generator
description: "PMV_Generator reference project — what we kept, what we dropped, and why"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

Mixer is a rebuild of `/Users/vincent/Projects/rocketmen/pmv-generator` (Python, moviepy-based).

**Kept from reference:**
- Shuffled round-robin scene selection with anti-consecutive constraint (`PMV_Fns/functions.py` lines 178-179, 322-324)
- Fade in/out on final output
- Core concept: BGM analysis → scene switch points → video slicing → concat

**Dropped:**
- AI video classification (`Classify_Model/`) — bloat, not needed
- Video downloading (`PMV_Fns/downloadVid.py`) — user provides local files
- moviepy for video manipulation — replaced by raw ffmpeg (much faster)
- Audio normalization across source videos — we replace audio with BGM entirely
- CSV-based video metadata management
- "Cock Hero" beat meter overlay features
- Profile management / complex UI

**Why:** The reference is Python, slow (moviepy), and heavily coupled to features mixer doesn't need. The rebuild keeps the validated mixing algorithm (shuffled round-robin) but uses ffmpeg directly for speed and Electron for a proper UI.

**How to apply:** When designing mixer features, check if the reference has a relevant implementation in `PMV_Fns/functions.py` — but don't port Python patterns directly. Use the reference for algorithm validation, not code structure.
