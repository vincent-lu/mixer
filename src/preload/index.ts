import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AnalysisResult,
  AppSettings,
  MixJob,
  MixJobConfig,
  Preset,
} from '../shared/types'

const api = {
  // Platform
  ping: (): Promise<string> => ipcRenderer.invoke('platform:ping'),
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('platform:selectDirectory'),
  selectVideoFiles: (): Promise<string[]> => ipcRenderer.invoke('platform:selectVideoFiles'),
  selectAudioFile: (): Promise<string | null> => ipcRenderer.invoke('platform:selectAudioFile'),
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
  updateJobAnalysis: (id: number, result: AnalysisResult): Promise<void> =>
    ipcRenderer.invoke('jobs:updateAnalysis', id, result),
  retryJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:retry', id),
  cancelJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:cancel', id),
  deleteJob: (id: number): Promise<void> => ipcRenderer.invoke('jobs:delete', id),

  // Presets
  listPresets: (): Promise<Preset[]> => ipcRenderer.invoke('presets:list'),
  createPreset: (input: { name: string; config: MixJobConfig }): Promise<Preset> =>
    ipcRenderer.invoke('presets:create', input),
  updatePreset: (id: number, input: { name?: string; config?: MixJobConfig }): Promise<void> =>
    ipcRenderer.invoke('presets:update', id, input),
  deletePreset: (id: number): Promise<void> => ipcRenderer.invoke('presets:delete', id),

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
