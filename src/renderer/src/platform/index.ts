import { electronPlatform } from './electron'
import type { Platform } from './types'

export const platform: Platform = electronPlatform

export type { Platform }
export type {
  AnalysisResult,
  AppSettings,
  ConvertResult,
  DuplicateGroup,
  MixJob,
  MixJobConfig,
  MixJobStatus,
  NormalizeFileStatus,
  Preset,
  ProgressStage,
} from '@shared/types'
