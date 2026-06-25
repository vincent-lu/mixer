import { desc, eq } from 'drizzle-orm'
import type { MixJobConfig, Preset } from '../../shared/types'
import { getDb } from './client'
import { presets, type PresetRow } from './schema'

function toSerializable(row: PresetRow): Preset {
  return {
    id: row.id,
    name: row.name,
    config: row.config,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export function listPresets(): Preset[] {
  const db = getDb()
  const rows = db.select().from(presets).orderBy(desc(presets.createdAt)).all()
  return rows.map(toSerializable)
}

export function createPreset(input: { name: string; config: MixJobConfig }): Preset {
  const db = getDb()
  const now = new Date()
  const row = db
    .insert(presets)
    .values({
      name: input.name,
      config: input.config,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get()
  return toSerializable(row)
}

export function updatePreset(
  id: number,
  input: { name?: string; config?: MixJobConfig },
): void {
  const db = getDb()
  const update: Record<string, unknown> = { updatedAt: new Date() }
  if (input.name !== undefined) update.name = input.name
  if (input.config !== undefined) update.config = input.config
  db.update(presets).set(update).where(eq(presets.id, id)).run()
}

export function deletePreset(id: number): void {
  const db = getDb()
  db.delete(presets).where(eq(presets.id, id)).run()
}
