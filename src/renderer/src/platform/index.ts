import { electronPlatform } from './electron'
import type { Platform } from './types'

export const platform: Platform = electronPlatform

export type { Platform }
export type {
  AnalysisResult,
  AppSettings,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  Preset,
  ProgressStage,
} from '@shared/types'
