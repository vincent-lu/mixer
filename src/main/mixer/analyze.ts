import type { AnalysisResult } from '@shared/types'
import { probeAudioDuration } from './probe'

export const DEFAULT_SEGMENT_DURATION = 4

export async function analyzeBgm(
  bgmPath: string,
  segmentDuration: number = DEFAULT_SEGMENT_DURATION,
): Promise<AnalysisResult> {
  const bgmDuration = await probeAudioDuration(bgmPath)

  const sectionTimings: number[] = [0]
  for (let i = 1; i * segmentDuration < bgmDuration; i++) {
    sectionTimings.push(i * segmentDuration)
  }
  sectionTimings.push(bgmDuration)

  return {
    bpm: 0,
    sectionTimings,
    bgmDuration,
    sceneCount: sectionTimings.length - 1,
  }
}
