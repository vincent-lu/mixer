import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AnalysisResult,
  AppSettings,
  MixJob,
  MixJobConfig,
  Preset,
  ProgressStage,
} from '../shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Platform
      ping(): Promise<string>
      selectDirectory(): Promise<string | null>
      selectVideoFiles(): Promise<string[]>
      selectAudioFile(): Promise<string | null>
      ffmpegVersion(): Promise<{ ffmpeg: string; ffprobe: string }>
      openPath(path: string): Promise<string>
      showItemInFolder(path: string): Promise<void>

      // Jobs
      listJobs(): Promise<MixJob[]>
      getJob(id: number): Promise<MixJob | null>
      createJob(input: { name: string; config: MixJobConfig }): Promise<MixJob>
      updateJobAnalysis(id: number, result: AnalysisResult): Promise<void>
      retryJob(id: number): Promise<void>
      cancelJob(id: number): Promise<void>
      deleteJob(id: number): Promise<void>

      // Job events (push from runner)
      onJobProgress(
        callback: (data: { id: number; progress: number; stage: ProgressStage }) => void,
      ): () => void
      onJobStatusChange(callback: (job: MixJob) => void): () => void

      // Presets
      listPresets(): Promise<Preset[]>
      createPreset(input: { name: string; config: MixJobConfig }): Promise<Preset>
      updatePreset(id: number, input: { name?: string; config?: MixJobConfig }): Promise<void>
      deletePreset(id: number): Promise<void>

      // App state
      getSettings(): Promise<AppSettings>
      setMaxConcurrency(concurrency: number): Promise<void>
      setDefaultOutputDir(dir: string | null): Promise<void>
      setLastUsedPresetId(id: number | null): Promise<void>
    }
  }
}
