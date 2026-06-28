import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'
import type {
  AppSettings,
  ConvertProgress,
  ConvertResult,
  DuplicateGroup,
  MixJob,
  MixJobConfig,
  NormalizeFileStatus,
  NormalizeProgress,
  Preset,
  ProgressStage,
} from '../shared/types'

const api = {
  // Platform
  ping: (): Promise<string> => ipcRenderer.invoke('platform:ping'),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('platform:selectDirectory'),
  selectVideoFiles: (): Promise<string[]> => ipcRenderer.invoke('platform:selectVideoFiles'),
  selectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('platform:selectAudioFile'),
  listMediaFiles: (input: { dir: string; type: 'video' | 'audio' | 'audio-only' }): Promise<string[]> =>
    ipcRenderer.invoke('platform:listMediaFiles', input),
  ffmpegVersion: (): Promise<{ ffmpeg: string; ffprobe: string }> =>
    ipcRenderer.invoke('platform:ffmpegVersion'),
  openPath: (path: string): Promise<string> => ipcRenderer.invoke('platform:openPath', path),
  showItemInFolder: (path: string): Promise<void> =>
    ipcRenderer.invoke('platform:showItemInFolder', path),

  // Jobs
  listJobs: (): Promise<MixJob[]> => ipcRenderer.invoke('jobs:list'),
  getJob: (id: number): Promise<MixJob | null> => ipcRenderer.invoke('jobs:get', id),
  createJob: (input: { name: string; config: MixJobConfig }): Promise<MixJob> =>
    ipcRenderer.invoke('jobs:create', input),
  createBatch: (inputs: Array<{ name: string; config: MixJobConfig }>): Promise<MixJob[]> =>
    ipcRenderer.invoke('jobs:create-batch', inputs),
  retryJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:retry', id),
  cancelJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:cancel', id),
  deleteJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:delete', id),
  setQueuePaused: (value: boolean): Promise<void> => ipcRenderer.invoke('jobs:set-paused', value),
  isQueuePaused: (): Promise<boolean> => ipcRenderer.invoke('jobs:is-paused'),

  // Job events (push from runner)
  onJobProgress: (
    callback: (data: { id: number; progress: number; stage: ProgressStage }) => void,
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: { id: number; progress: number; stage: ProgressStage }): void => callback(data)
    ipcRenderer.on('job:progress', listener)
    return () => { ipcRenderer.removeListener('job:progress', listener) }
  },
  onJobStatusChange: (callback: (job: MixJob) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, job: MixJob): void => callback(job)
    ipcRenderer.on('job:status-change', listener)
    return () => { ipcRenderer.removeListener('job:status-change', listener) }
  },

  // Presets
  listPresets: (): Promise<Preset[]> => ipcRenderer.invoke('presets:list'),
  createPreset: (input: { name: string; config: MixJobConfig }): Promise<Preset> =>
    ipcRenderer.invoke('presets:create', input),
  updatePreset: (id: number, input: { name?: string; config?: MixJobConfig }): Promise<void> =>
    ipcRenderer.invoke('presets:update', id, input),
  deletePreset: (id: number): Promise<void> => ipcRenderer.invoke('presets:delete', id),

  // Tools
  convertMp4ToMp3: (dir: string): Promise<ConvertResult[]> =>
    ipcRenderer.invoke('tools:convert-mp4-to-mp3', dir),
  findDuplicateBgms: (dir: string): Promise<DuplicateGroup[]> =>
    ipcRenderer.invoke('tools:find-duplicates', dir),
  deleteFiles: (paths: string[]): Promise<ConvertResult[]> =>
    ipcRenderer.invoke('tools:delete-files', paths),
  onConvertProgress: (callback: (data: ConvertProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: ConvertProgress): void => callback(data)
    ipcRenderer.on('tools:convert-progress', listener)
    return () => { ipcRenderer.removeListener('tools:convert-progress', listener) }
  },
  scanNormalize: (dir: string): Promise<NormalizeFileStatus[]> =>
    ipcRenderer.invoke('tools:scan-normalize', dir),
  normalizeVideos: (paths: string[]): Promise<ConvertResult[]> =>
    ipcRenderer.invoke('tools:normalize-videos', paths),
  onNormalizeProgress: (callback: (data: NormalizeProgress) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: NormalizeProgress): void => callback(data)
    ipcRenderer.on('tools:normalize-progress', listener)
    return () => { ipcRenderer.removeListener('tools:normalize-progress', listener) }
  },

  // App state
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('state:getSettings'),
  setMaxConcurrency: (concurrency: number): Promise<void> =>
    ipcRenderer.invoke('state:setMaxConcurrency', concurrency),
  setDefaultOutputDir: (dir: string | null): Promise<void> =>
    ipcRenderer.invoke('state:setDefaultOutputDir', dir),
  setLastUsedPresetId: (id: number | null): Promise<void> =>
    ipcRenderer.invoke('state:setLastUsedPresetId', id),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error contextIsolation disabled fallback
  window.electron = electronAPI
  // @ts-expect-error contextIsolation disabled fallback
  window.api = api
}
