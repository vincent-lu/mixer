export type MixJobStatus = 'pending' | 'analyzing' | 'mixing' | 'done' | 'failed' | 'cancelled'

export type ProgressStage = 'normalizing' | 'analyzing' | 'mixing' | 'encoding'

export type SceneDetectionMode = 'random' | 'ffmpeg'

export type OutputFormat = 'mp4' | 'mkv' | 'mov'

export type VideoResolution = '1080p' | '720p' | '480p' | 'source'

export type MixStyle = 'chill' | 'relaxed' | 'balanced' | 'energetic' | 'hyperkinetic' | 'frenetic' | 'chaos'

export type TransitionEffect = 'cut' | 'circleopen' | 'fadewhite' | 'horzopen' | 'vertopen' | 'acid' | 'doublevision' | 'solarize' | 'strobe' | 'strobe_white'

export type ClipEffect = 'none' | 'shake' | 'shake_hard' | 'shake_blur' | 'zoompulse' | 'kenburns' | 'drift' | 'vignette_pulse' | 'hueshift' | 'flashpulse' | 'negflash' | 'chromatic'

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
  transitionDensity?: number
  transitionEffect?: TransitionEffect
  clipEffect?: ClipEffect
  effectChance?: number
  lookahead?: number
  autoStyle?: boolean
  intensityBias?: number
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

export const DEFAULT_STYLE_LOOKAHEAD: Record<MixStyle, number> = {
  chill: 1.0,
  relaxed: 0.8,
  balanced: 0.5,
  energetic: 0.3,
  hyperkinetic: 0.2,
  frenetic: 0.1,
  chaos: 0.0,
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  maxConcurrency: 1,
  defaultOutputDir: null,
  lastUsedPresetId: null,
}
