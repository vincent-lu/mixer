---
name: feedback-pre-commit-concat
description: "ffmpeg concat demuxer uses single-quote escaping, not double-quote — reviewer was wrong about av_get_token"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c6648d9e-045b-4a33-8119-32d20ee24119
---

The ffmpeg concat demuxer (`ffconcat version 1.0`) requires single-quote or backslash escaping for file paths. Double-quote escaping (`file "path"`) does NOT work — ffmpeg treats the quotes as literal path characters.

**Why:** A pre-commit reviewer suggested switching to double-quote escaping citing `av_get_token` compatibility. Applied the change, tested, ffmpeg failed with path resolution errors. Reverted to single-quote `'\''` style which works correctly.

**How to apply:** When generating concat demuxer files, always use single-quoted paths. Don't accept reviewer suggestions about double-quote escaping for ffconcat format without testing against real ffmpeg first.
