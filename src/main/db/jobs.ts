import { desc, eq } from 'drizzle-orm'
import type {
  AnalysisResult,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  ProgressStage,
} from '../../shared/types'
import { getDb } from './client'
import { jobs, type JobRow } from './schema'

function toSerializable(row: JobRow): MixJob {
  return {
    id: row.id,
    name: row.name,
    status: row.status as MixJobStatus,
    config: row.config,
    analysisResult: row.analysisResult ?? null,
    progress: row.progress,
    progressStage: (row.progressStage as ProgressStage | undefined) ?? null,
    error: row.error ?? null,
    outputPath: row.outputPath ?? null,
    createdAt: row.createdAt.getTime(),
    startedAt: row.startedAt?.getTime() ?? null,
    completedAt: row.completedAt?.getTime() ?? null,
  }
}

export function listJobs(): MixJob[] {
  const db = getDb()
  const rows = db.select().from(jobs).orderBy(desc(jobs.createdAt)).all()
  return rows.map(toSerializable)
}

export function getJob(id: number): MixJob | null {
  const db = getDb()
  const row = db.select().from(jobs).where(eq(jobs.id, id)).get()
  return row ? toSerializable(row) : null
}

export function createJob(input: { name: string; config: MixJobConfig }): MixJob {
  const db = getDb()
  const now = new Date()
  const row = db
    .insert(jobs)
    .values({
      name: input.name,
      config: input.config,
      createdAt: now,
    })
    .returning()
    .get()
  return toSerializable(row)
}

export function updateJobStatus(id: number, status: MixJobStatus): void {
  const db = getDb()
  const update: Record<string, unknown> = { status }
  if (status !== 'pending') {
    const existing = db.select({ startedAt: jobs.startedAt }).from(jobs).where(eq(jobs.id, id)).get()
    if (!existing?.startedAt) {
      update.startedAt = new Date()
    }
  }
  db.update(jobs).set(update).where(eq(jobs.id, id)).run()
}

export function updateJobProgress(id: number, progress: number, stage: ProgressStage): void {
  const db = getDb()
  db.update(jobs).set({ progress, progressStage: stage }).where(eq(jobs.id, id)).run()
}

export function updateJobAnalysis(id: number, result: AnalysisResult): void {
  const db = getDb()
  db.update(jobs).set({ analysisResult: result }).where(eq(jobs.id, id)).run()
}

export function completeJob(id: number, outputPath: string): void {
  const db = getDb()
  db.update(jobs)
    .set({
      status: 'done',
      outputPath,
      progress: 100,
      completedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .run()
}

export function failJob(id: number, error: string): void {
  const db = getDb()
  db.update(jobs)
    .set({
      status: 'failed',
      error,
      completedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .run()
}

export function cancelJob(id: number): void {
  const db = getDb()
  db.update(jobs)
    .set({
      status: 'cancelled',
      completedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .run()
}

export function deleteJob(id: number): void {
  const db = getDb()
  db.delete(jobs).where(eq(jobs.id, id)).run()
}
