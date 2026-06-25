import type { AppSettings } from '../../shared/types'
import { DEFAULT_APP_SETTINGS } from '../../shared/types'
import { getDb } from './client'
import { appState } from './schema'

const STATE_ID = 1

export function getAppSettings(): AppSettings {
  const db = getDb()
  const row = db.select().from(appState).limit(1).get()
  if (!row) return { ...DEFAULT_APP_SETTINGS }
  return {
    maxConcurrency: row.maxConcurrency,
    defaultOutputDir: row.defaultOutputDir ?? null,
    lastUsedPresetId: row.lastUsedPresetId ?? null,
  }
}

export function setMaxConcurrency(concurrency: number): void {
  const clamped = Math.max(1, Math.min(8, concurrency))
  const db = getDb()
  db.insert(appState)
    .values({ id: STATE_ID, maxConcurrency: clamped })
    .onConflictDoUpdate({
      target: appState.id,
      set: { maxConcurrency: clamped },
    })
    .run()
}

export function setDefaultOutputDir(dir: string | null): void {
  const db = getDb()
  db.insert(appState)
    .values({ id: STATE_ID, defaultOutputDir: dir })
    .onConflictDoUpdate({
      target: appState.id,
      set: { defaultOutputDir: dir },
    })
    .run()
}

export function setLastUsedPresetId(id: number | null): void {
  const db = getDb()
  db.insert(appState)
    .values({ id: STATE_ID, lastUsedPresetId: id })
    .onConflictDoUpdate({
      target: appState.id,
      set: { lastUsedPresetId: id },
    })
    .run()
}
