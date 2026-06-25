import { ipcMain } from 'electron'
import type { MixJob, MixJobConfig } from '../../shared/types'
import { createJob, deleteJob, getJob, listJobs, retryJob } from '../db/jobs'
import { cancelRunningJob, notifyNewJob } from '../runner'

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
      const job = createJob(input)
      notifyNewJob()
      return job
    },
  )

  ipcMain.handle('jobs:retry', async (_event, id: number): Promise<void> => {
    retryJob(id)
    notifyNewJob()
  })

  ipcMain.handle('jobs:cancel', async (_event, id: number): Promise<void> => {
    cancelRunningJob(id)
  })

  ipcMain.handle('jobs:delete', async (_event, id: number): Promise<void> => {
    deleteJob(id)
  })
}
