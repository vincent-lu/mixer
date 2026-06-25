import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { join } from 'path'
import { DEFAULT_APP_SETTINGS } from '../../shared/types'
import { getDb } from './client'
import { appState } from './schema'

function getMigrationsPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'drizzle')
  }
  return join(process.resourcesPath, 'drizzle')
}

export function runMigrations(): void {
  const migrationsFolder = getMigrationsPath()
  console.log('[db] running migrations from:', migrationsFolder)
  try {
    migrate(getDb(), { migrationsFolder })
    console.log('[db] migrations complete')
  } catch (err) {
    console.error('[db] migration failed:', err)
    throw err
  }
  ensureDefaultState()
}

const STATE_ID = 1

function ensureDefaultState(): void {
  const db = getDb()
  db.transaction((tx) => {
    const existing = tx.select({ id: appState.id }).from(appState).limit(1).get()

    if (!existing) {
      tx.insert(appState)
        .values({
          id: STATE_ID,
          maxConcurrency: DEFAULT_APP_SETTINGS.maxConcurrency,
          defaultOutputDir: DEFAULT_APP_SETTINGS.defaultOutputDir,
          lastUsedPresetId: DEFAULT_APP_SETTINGS.lastUsedPresetId,
        })
        .run()
      console.log('[db] bootstrap: seeded default app state')
    }
  })
}
