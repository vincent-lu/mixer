---
name: project-tools
description: Tools tab with 3 utilities — MP4→MP3 converter, duplicate BGM finder, video pre-normalizer
metadata:
  type: project
---

Standalone utility tools accessible via a 3rd tab alongside Single/Batch.

**Current state:** Implemented. Three swarm review rounds, all bugs fixed.

- 3-way mode toggle in JobConfig.vue (`single` | `batch` | `tools`); `v-show` keeps ToolsPanel mounted across mode switches
- Mode watcher preserves single/batch config when switching to/from tools
- New `src/main/ipc/tools.ts` with 5 IPC handlers, registered in `index.ts`
- Full IPC wiring: shared types → preload bridge → platform layer → Vue component

**Tool 1 — MP4→MP3 Converter:**
- Scans folder recursively for .mp4 files
- Converts with `runFfmpeg` (spawn-based, no maxBuffer issue) using LAME VBR Q2
- Writes to `.mp3.tmp`, renames on success, deletes temp on failure (no partial files)
- Skips if .mp3 already exists (shown as dimmed "skipped" in UI, not error)
- Deletes original MP4 with `unlink` after successful conversion (intentional — user spec)

**Tool 2 — Duplicate BGM Finder:**
- Groups audio files by exact filesize or fuzzy filename matching
- Fuzzy matcher strips: `(N)`, `- Copy`, `copy`, `_copy` patterns (no bare numeric suffixes — avoids track number false positives)
- Per-item `shell.trashItem` with error isolation, returns `ConvertResult[]`
- Delete errors surfaced inline in UI

**Tool 3 — Pre-Normalize Videos:**
- Probes each video with `probeVideo`, shows which need H.264/1920x1080/30fps normalization
- Reuses pipeline's `buildNormalizeArgs`/`runFfmpeg`/`DEFAULT_PRESET`
- `isLocalPath` guard rejects network/external drives
- Probe failures reported as errors (not `needsWork`), shown separately in UI
- In-place replacement via temp file + rename (same pattern as pipeline's `normalizeVideo`)

**Design decisions:**
- `v-show` (not `v-if`) for ToolsPanel — state survives mode switches, progress listeners stay active
- Temp-file-then-rename for both converter and normalizer — prevents partial output files
- `unlink` for MP4 originals (irreversible by design), `trashItem` for duplicate deletion (recoverable)
- `ConvertResult` type reused across all tools (file + ok + error + skipped)
- Progress events follow existing push pattern (broadcast via `webContents.send`, update-only handlers)

**Why:** Manual video/audio file management doesn't scale when preparing inputs for batch mixing.

**How to apply:** Feature is complete. See `docs/design.md` Tools section for spec.
