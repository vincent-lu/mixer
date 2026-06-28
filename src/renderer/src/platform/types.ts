import type {
  AnalysisResult,
  AppSettings,
  ConvertProgress,
  ConvertResult,
  DuplicateGroup,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  NormalizeFileStatus,
  NormalizeProgress,
  Preset,
  ProgressStage,
} from '@shared/types'

export interface Platform {
  ping(): Promise<string>
  selectDirectory(): Promise<string | null>
  selectVideoFiles(): Promise<string[]>
  selectAudioFile(): Promise<string | null>
  listMediaFiles(input: { dir: string; type: 'video' | 'audio' | 'audio-only' }): Promise<string[]>
  ffmpegVersion(): Promise<{ ffmpeg: string; ffprobe: string }>
  openPath(path: string): Promise<string>
  showItemInFolder(path: string): Promise<void>

  listJobs(): Promise<MixJob[]>
  getJob(id: number): Promise<MixJob | null>
  createJob(input: { name: string; config: MixJobConfig }): Promise<MixJob>
  createBatch(inputs: Array<{ name: string; config: MixJobConfig }>): Promise<MixJob[]>
  retryJob(id: number): Promise<void>
  cancelJob(id: number): Promise<void>
  deleteJob(id: number): Promise<void>
  setQueuePaused(value: boolean): Promise<void>
  isQueuePaused(): Promise<boolean>

  onJobProgress(
    callback: (data: { id: number; progress: number; stage: ProgressStage }) => void,
  ): () => void
  onJobStatusChange(callback: (job: MixJob) => void): () => void

  listPresets(): Promise<Preset[]>
  createPreset(input: { name: string; config: MixJobConfig }): Promise<Preset>
  updatePreset(id: number, input: { name?: string; config?: MixJobConfig }): Promise<void>
  deletePreset(id: number): Promise<void>

  convertMp4ToMp3(dir: string): Promise<ConvertResult[]>
  findDuplicateBgms(dir: string): Promise<DuplicateGroup[]>
  deleteFiles(paths: string[]): Promise<ConvertResult[]>
  onConvertProgress(callback: (data: ConvertProgress) => void): () => void
  scanNormalize(dir: string): Promise<NormalizeFileStatus[]>
  normalizeVideos(paths: string[]): Promise<ConvertResult[]>
  onNormalizeProgress(callback: (data: NormalizeProgress) => void): () => void

  getSettings(): Promise<AppSettings>
  setMaxConcurrency(concurrency: number): Promise<void>
  setDefaultOutputDir(dir: string | null): Promise<void>
  setLastUsedPresetId(id: number | null): Promise<void>
}

export type {
  AnalysisResult,
  AppSettings,
  ConvertProgress,
  ConvertResult,
  DuplicateGroup,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  NormalizeFileStatus,
  NormalizeProgress,
  Preset,
  ProgressStage,
}
