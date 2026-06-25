import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listJobs, updateJobStatus, updateJobProgress, completeJob, failJob, cancelJob } from './db/jobs'
import { getAppSettings } from './db/state'
import { runMixPipeline } from './mixer/pipeline'
import type { MixJob, MixJobStatus } from '../shared/types'

const running = new Map<number, AbortController>()
let stopped = false

export function startRunner(): void {
  const all = listJobs()
  for (const job of all) {
    if (job.status === 'analyzing' || job.status === 'mixing') {
      failJob(job.id, 'Interrupted by application exit')
    }
  }
  processQueue()
}

export function stopRunner(): void {
  stopped = true
  for (const controller of running.values()) {
    controller.abort()
  }
  running.clear()
}

export function notifyNewJob(): void {
  processQueue()
}

export function cancelRunningJob(id: number): void {
  const controller = running.get(id)
  if (controller) {
    controller.abort()
  } else {
    cancelJob(id)
  }
}

function processQueue(): void {
  if (stopped) return
  const { maxConcurrency } = getAppSettings()
  const available = maxConcurrency - running.size
  if (available <= 0) return

  const pending = listJobs()
    .filter((j) => j.status === 'pending')
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, available)

  for (const job of pending) {
    void executeJob(job)
  }
}

async function executeJob(job: MixJob): Promise<void> {
  const controller = new AbortController()
  running.set(job.id, controller)

  let lastStatus: MixJobStatus | null = null

  try {
    updateJobStatus(job.id, 'analyzing')
    lastStatus = 'analyzing'

    const outputPath = buildOutputPath(job)

    const result = await runMixPipeline({
      bgmPath: job.config.bgmPath,
      sourceVideoPaths: job.config.sourceVideoPaths,
      outputPath,
      minSegmentDuration: job.config.minSegmentDuration,
      onProgress: (stage, percent) => {
        const status = stage === 'analyzing' ? 'analyzing' : 'mixing'
        if (status !== lastStatus) {
          updateJobStatus(job.id, status)
          lastStatus = status
        }
        updateJobProgress(job.id, Math.round(percent), stage)
      },
      signal: controller.signal,
    })

    completeJob(job.id, result.outputPath)
  } catch (err) {
    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else {
      failJob(job.id, err instanceof Error ? err.message : String(err))
    }
  } finally {
    running.delete(job.id)
    processQueue()
  }
}

function buildOutputPath(job: MixJob): string {
  const sanitized = job.name.replace(/[^a-zA-Z0-9 _-]/g, '_').trim() || 'mix'
  const ext = job.config.outputFormat
  const dir = job.config.outputDir

  let candidate = join(dir, `${sanitized}.${ext}`)
  let counter = 1
  while (existsSync(candidate)) {
    candidate = join(dir, `${sanitized}-${counter}.${ext}`)
    counter++
  }

  return candidate
}
