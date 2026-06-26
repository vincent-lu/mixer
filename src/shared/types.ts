export type MixJobStatus = 'pending' | 'analyzing' | 'mixing' | 'done' | 'failed' | 'cancelled'

export type ProgressStage = 'normalizing' | 'analyzing' | 'mixing' | 'encoding'

export type SceneDetectionMode = 'random' | 'ffmpeg'

export type OutputFormat = 'mp4' | 'mkv' | 'mov'

export type VideoResolution = '1080p' | '720p' | '480p' | 'source'

export type MixStyle = 'chill' | 'relaxed' | 'balanced' | 'energetic' | 'hyperkinetic'

export interface BeatInfo {
  time: number
  score: number
  energy: number
  onsetDistance: number
}

export interface Section {
  start: number
  end: number
  energy: 'low' | 'medium' | 'high'
}

export interface MixJobConfig {
  bgmPath: string
  sourceVideoPaths: string[]
  outputDir: string
  outputFormat: OutputFormat
  sceneDetection: SceneDetectionMode
  videoResolution: VideoResolution
  minSegmentDuration?: number
  outputFilename?: string
  mixStyle?: MixStyle
  enableTransitions?: boolean
}

export interface AnalysisResult {
  bpm: number
  sectionTimings: number[]
  bgmDuration: number
  sceneCount: number
  beats?: BeatInfo[]
  onsets?: number[]
  sections?: Section[]
}

export interface MixJob {
  id: number
  name: string
  status: MixJobStatus
  config: MixJobConfig
  analysisResult: AnalysisResult | null
  progress: number
  progressStage: ProgressStage | null
  error: string | null
  outputPath: string | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
}

export interface Preset {
  id: number
  name: string
  config: MixJobConfig
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  maxConcurrency: number
  defaultOutputDir: string | null
  lastUsedPresetId: number | null
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maxConcurrency: 1,
  defaultOutputDir: null,
  lastUsedPresetId: null,
}
