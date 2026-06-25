import type { Platform } from './types'

export const electronPlatform: Platform = {
  ping: () => window.api.ping(),
  selectDirectory: () => window.api.selectDirectory(),
  selectVideoFiles: () => window.api.selectVideoFiles(),
  selectAudioFile: () => window.api.selectAudioFile(),
  ffmpegVersion: () => window.api.ffmpegVersion(),
  openPath: (path) => window.api.openPath(path),
  showItemInFolder: (path) => window.api.showItemInFolder(path),

  listJobs: () => window.api.listJobs(),
  getJob: (id) => window.api.getJob(id),
  createJob: (input) => window.api.createJob(input),
  updateJobStatus: (id, status) => window.api.updateJobStatus(id, status),
  updateJobProgress: (id, progress, stage) => window.api.updateJobProgress(id, progress, stage),
  updateJobAnalysis: (id, result) => window.api.updateJobAnalysis(id, result),
  completeJob: (id, outputPath) => window.api.completeJob(id, outputPath),
  failJob: (id, error) => window.api.failJob(id, error),
  cancelJob: (id) => window.api.cancelJob(id),
  deleteJob: (id) => window.api.deleteJob(id),

  listPresets: () => window.api.listPresets(),
  createPreset: (input) => window.api.createPreset(input),
  updatePreset: (id, input) => window.api.updatePreset(id, input),
  deletePreset: (id) => window.api.deletePreset(id),

  getSettings: () => window.api.getSettings(),
  setMaxConcurrency: (concurrency) => window.api.setMaxConcurrency(concurrency),
  setDefaultOutputDir: (dir) => window.api.setDefaultOutputDir(dir),
  setLastUsedPresetId: (id) => window.api.setLastUsedPresetId(id),
}
