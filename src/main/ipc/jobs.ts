import { ipcMain } from 'electron'
import type {
  AnalysisResult,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  ProgressStage,
} from '../../shared/types'
import {
  cancelJob,
  completeJob,
  createJob,
  deleteJob,
  failJob,
  getJob,
  listJobs,
  updateJobAnalysis,
  updateJobProgress,
  updateJobStatus,
} from '../db/jobs'

export function registerJobsHandlers(): void {
  ipcMain.handle('jobs:list', async (): Promise<MixJob[]> => {
    return listJobs()
  })

  ipcMain.handle('jobs:get', async (_event, id: number): Promise<MixJob | null> => {
    return getJob(id)
  })

  ipcMain.handle(
    'jobs:create',
    async (_event, input: { name: string; config: MixJobConfig }): Promise<MixJob> => {
      return createJob(input)
    },
  )

  ipcMain.handle(
    'jobs:updateStatus',
    async (_event, id: number, status: MixJobStatus): Promise<void> => {
      updateJobStatus(id, status)
    },
  )

  ipcMain.handle(
    'jobs:updateProgress',
    async (_event, id: number, progress: number, stage: ProgressStage): Promise<void> => {
      updateJobProgress(id, progress, stage)
    },
  )

  ipcMain.handle(
    'jobs:updateAnalysis',
    async (_event, id: number, result: AnalysisResult): Promise<void> => {
      updateJobAnalysis(id, result)
    },
  )

  ipcMain.handle(
    'jobs:complete',
    async (_event, id: number, outputPath: string): Promise<void> => {
      completeJob(id, outputPath)
    },
  )

  ipcMain.handle('jobs:fail', async (_event, id: number, error: string): Promise<void> => {
    failJob(id, error)
  })

  ipcMain.handle('jobs:cancel', async (_event, id: number): Promise<void> => {
    cancelJob(id)
  })

  ipcMain.handle('jobs:delete', async (_event, id: number): Promise<void> => {
    deleteJob(id)
  })
}
