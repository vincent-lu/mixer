import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { BrowserWindow } from 'electron'
import { getJob, listJobs, updateJobStatus, updateJobProgress, completeJob, failJob, cancelJob } from './db/jobs'
import { getAppSettings } from './db/state'
import { runMixPipeline } from './mixer/pipeline'
import type { MixJob, MixJobStatus } from '../shared/types'

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, ...args)
  }
}

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
    broadcast('job:status-change', getJob(job.id))

    const outputPath = buildOutputPath(job)

    const legacyTransitions = (job.config as unknown as Record<string, unknown>).enableTransitions
    const result = await runMixPipeline({
      bgmPath: job.config.bgmPath,
      sourceVideoPaths: job.config.sourceVideoPaths,
      outputPath,
      minSegmentDuration: job.config.minSegmentDuration,
      mixStyle: job.config.mixStyle,
      transitionDensity: job.config.transitionDensity ?? (legacyTransitions === false ? 0 : 30),
      transitionEffect: job.config.transitionEffect ?? 'circleopen',
      clipEffect: job.config.clipEffect,
      effectChance: job.config.effectChance,
      lookahead: job.config.lookahead,
      autoStyle: job.config.autoStyle,
      intensityBias: job.config.intensityBias,
      onProgress: (stage, percent) => {
        const status = stage === 'mixing' || stage === 'encoding' ? 'mixing' : 'analyzing'
        if (status !== lastStatus) {
          updateJobStatus(job.id, status)
          lastStatus = status
          broadcast('job:status-change', getJob(job.id))
        }
        const progress = Math.round(percent)
        updateJobProgress(job.id, progress, stage)
        broadcast('job:progress', { id: job.id, progress, stage })
      },
      signal: controller.signal,
    })

    completeJob(job.id, result.outputPath)
    broadcast('job:status-change', getJob(job.id))
  } catch (err) {
    if (controller.signal.aborted) {
      cancelJob(job.id)
    } else {
      failJob(job.id, err instanceof Error ? err.message : String(err))
    }
    broadcast('job:status-change', getJob(job.id))
  } finally {
    running.delete(job.id)
    processQueue()
  }
}

function buildOutputPath(job: MixJob): string {
  const baseName = job.config.outputFilename
    ? job.config.outputFilename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
    : job.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
  const sanitized = baseName || 'mix'
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
