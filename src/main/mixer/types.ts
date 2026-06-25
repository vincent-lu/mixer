import type { ProgressStage } from '@shared/types'

export interface ProbeResult {
  path: string
  duration: number
  width: number
  height: number
  codec: string
  fps: number
}

export interface Segment {
  sourceIndex: number
  sourcePath: string
  inpoint: number
  outpoint: number
}

export interface SegmentPlan {
  segments: Segment[]
  totalDuration: number
}

export type OnProgress = (stage: ProgressStage, percent: number) => void

export interface PipelineOptions {
  bgmPath: string
  sourceVideoPaths: string[]
  outputPath: string
  segmentDuration?: number
  minSegmentDuration?: number
  onProgress?: OnProgress
  signal?: AbortSignal
}

export interface NormalizePreset {
  codec: string
  width: number
  height: number
  fps: number
}

export interface PipelineResult {
  outputPath: string
  totalDuration: number
  segmentCount: number
}
