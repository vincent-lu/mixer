import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import * as schema from './schema'

export type Db = ReturnType<typeof drizzle<typeof schema>>

let dbInstance: Db | null = null
let sqliteInstance: Database.Database | null = null

export function getDbPath(): string {
  if (is.dev) {
    return join(app.getAppPath(), 'mixer.db')
  }
  return join(app.getPath('userData'), 'mixer.db')
}

export function openDatabase(): Db {
  const dbPath = getDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('busy_timeout = 2000')

  sqliteInstance = sqlite
  dbInstance = drizzle(sqlite, { schema })
  console.log('[db] opened:', dbPath)
  return dbInstance
}

export function closeDatabase(): void {
  if (sqliteInstance) {
    sqliteInstance.close()
    console.log('[db] closed')
  }
  sqliteInstance = null
  dbInstance = null
}

export function getDb(): Db {
  if (!dbInstance) {
    throw new Error('Database not opened — call openDatabase() first')
  }
  return dbInstance
}

export function getSqlite(): Database.Database {
  if (!sqliteInstance) {
    throw new Error('Database not opened — call openDatabase() first')
  }
  return sqliteInstance
}
