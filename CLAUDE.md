# mixer

Video mixer — beat-synced scene switching. Takes source videos + BGM, analyzes BGM with essentia.js for optimal scene switch timings, mixes into a new video with BGM as audio. Electron + Vue 3 (`<script setup>`, TS strict) + better-sqlite3/Drizzle + Vite/electron-vite. System ffmpeg required.

## Docs

- **[`docs/design.md`](docs/design.md)** — current-state spec: stack, architecture, data model, job lifecycle. **Start here.**
- **[`docs/decision-log.md`](docs/decision-log.md)** — append-only decision history.

## Rules

1. **No commits without explicit user approval.**
2. **Docs update in the same turn as decisions.** New decision → edit `design.md` AND append a dated `decision-log.md` entry.
3. **Preload must be `.mjs`.** electron-vite outputs `out/preload/index.mjs`; main references `'../preload/index.mjs'`.
4. **CSP directives in `src/renderer/index.html` are load-bearing.** `'wasm-unsafe-eval'` and `'unsafe-eval'` for essentia.js WASM, `worker-src 'self' blob:` for web workers.
5. **Vue reactive proxies can't cross IPC.** Unwrap via `JSON.parse(JSON.stringify(value))` or `ipcClone` before passing to `window.api.*`.
6. **System ffmpeg only.** Never bundle ffmpeg. Validate on startup, throw if missing.
7. **essentia.js WASM is reconstituted, not committed.** `scripts/copy-essentia-wasm.mjs` runs on `predev`/`prebuild`/`postinstall`. Missing → BPM detection fails. Restore: `pnpm setup:essentia`.

## Commands

```bash
pnpm dev                      # dev server with HMR (Electron + Vite)
pnpm typecheck                # tsc + vue-tsc on node + web configs
pnpm test                     # Vitest once
pnpm test:watch               # Vitest watch mode
pnpm db:generate              # Drizzle migration from schema changes
pnpm build                    # production build
pnpm setup:essentia           # restore essentia.js WASM runtime
```

## Testing

Pure-logic tests only — no component or UI tests. Tests in `__tests__/` subdirs, same filename as source. Validate UI by manual `pnpm dev` interaction.

## Recovery: better-sqlite3 ABI mismatch

Symptom: `NODE_MODULE_VERSION X vs Y` at startup after `pnpm install`. Fix:

```bash
node_modules/.pnpm/@electron+rebuild@*/node_modules/@electron/rebuild/node_modules/.bin/electron-rebuild -f -w better-sqlite3
```

## Architecture

| Layer | Concept | Code |
|-------|---------|------|
| L1 Data | DB + shared types | `src/main/db/`, `src/shared/types.ts` |
| L2 Mixer | Mixing pipeline (probe/analyze/plan/encode) | `src/main/mixer/` |
| L3 Jobs | Job lifecycle + IPC | `src/main/ipc/jobs.ts`, `src/main/ffmpeg/` |
| L4 Analysis | essentia.js BPM/onset | `src/renderer/src/audio/` |
| L5 UI | Vue components + Pinia | `src/renderer/src/components/`, `stores/` |

**Entry points:** `src/main/index.ts` (Electron main), `src/preload/index.ts` (contextBridge → `window.api`), `src/renderer/src/App.vue` (root), `src/shared/types.ts` (cross-process types), `src/renderer/src/platform/types.ts` (Platform interface).

## Workflow

- **Plan-then-execute:** design → file inventory → phases with typecheck gates → manual validation
- **Decisions:** surface options with tradeoffs, state lean, wait for direction
- **Session lifecycle:** `/session-start` → work → `/checkpoint` or `/handover`
