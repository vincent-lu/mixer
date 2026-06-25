import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type {
  AnalysisResult,
  MixJobConfig,
  MixJobStatus,
  ProgressStage,
} from '../../shared/types'

export const jobs = sqliteTable(
  'jobs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    status: text('status').$type<MixJobStatus>().notNull().default('pending'),
    config: text('config', { mode: 'json' }).$type<MixJobConfig>().notNull(),
    analysisResult: text('analysis_result', { mode: 'json' }).$type<AnalysisResult>(),
    progress: integer('progress').notNull().default(0),
    progressStage: text('progress_stage').$type<ProgressStage>(),
    error: text('error'),
    outputPath: text('output_path'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (t) => [index('jobs_status_idx').on(t.status), index('jobs_created_at_idx').on(t.createdAt)],
)

export const presets = sqliteTable('presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  config: text('config', { mode: 'json' }).$type<MixJobConfig>().notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
})

export const appState = sqliteTable('app_state', {
  id: integer('id').primaryKey(),
  maxConcurrency: integer('max_concurrency').notNull().default(3),
  defaultOutputDir: text('default_output_dir'),
  lastUsedPresetId: integer('last_used_preset_id').references(() => presets.id, {
    onDelete: 'set null',
  }),
})

export type JobRow = typeof jobs.$inferSelect
export type NewJob = typeof jobs.$inferInsert
export type PresetRow = typeof presets.$inferSelect
export type NewPreset = typeof presets.$inferInsert
export type AppStateRow = typeof appState.$inferSelect
