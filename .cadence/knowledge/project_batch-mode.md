---
name: project-batch-mode
description: Batch job creation from BGM/video folders — implemented with deck-dealing allocation, recursive scan, audio-only filter
metadata:
  type: project
---

Batch mode for creating multiple mix jobs at once from folder inputs.

**Current state:** Implemented.

- Single/Batch toggle in JobConfig.vue swaps file pickers for folder pickers
- Multiple BGM and video folders supported (add/remove, duplicate prevention, files aggregated)
- One job per BGM file across all folders, videos allocated via deck-dealing spread-across algorithm
- `listMediaFiles` IPC scans folders recursively with `readdir({ recursive: true })`
- `'audio-only'` type filter (default in batch) excludes video extensions from BGM scan
- `jobs:create-batch` IPC inserts N jobs in one transaction with single `notifyNewJob()`
- `allocateVideos` pure function with 7 test cases
- Job naming: `Mix — {bgm_basename} #{position}`
- Default videos per mix: 3

**Design decisions:**
- Batch is UI-only — no DB schema changes, no batch metadata table. Each job is a regular `MixJob`
- Runner/pipeline unaware of batch origin — processes jobs normally
- Video allocation maximizes spread, only overlaps when forced by ratio
- Queue pause/resume toggle (ephemeral, resets on restart) and clear completed jobs button in Job Queue header

**Why:** Manual single-job creation doesn't scale when mixing many BGMs against a video library.

**How to apply:** Feature is complete. See `docs/design.md` Batch Mode section for spec.
