import type { AnalysisResult } from '@shared/types'
import { extractPcm, detectBeats } from './audio'
import { probeAudioDuration } from './probe'

export const DEFAULT_SEGMENT_DURATION = 4

export interface AnalyzeOptions {
  segmentDuration?: number
  minSegmentDuration?: number
}

const BEAT_TOLERANCE = 0.02

export function selectBeats(ticks: number[], minDuration: number, bgmDuration: number): number[] {
  const threshold = minDuration - BEAT_TOLERANCE
  const timings: number[] = [0]

  for (const tick of ticks) {
    if (tick <= 0) continue
    if (tick >= bgmDuration) break
    if (tick - timings[timings.length - 1]! >= threshold) {
      timings.push(tick)
    }
  }

  const last = timings[timings.length - 1]!
  if (bgmDuration - last < threshold && timings.length > 1) {
    timings[timings.length - 1] = bgmDuration
  } else {
    timings.push(bgmDuration)
  }

  return timings
}

function bpmFromTicks(ticks: number[]): number {
  if (ticks.length < 2) return 0
  const intervals = ticks.slice(1).map((t, i) => t - ticks[i]!)
  const sorted = [...intervals].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
  if (median <= 0) return 0
  return Math.round((60 / median) * 10) / 10
}

function fixedIntervalTimings(bgmDuration: number, segmentDuration: number): number[] {
  const timings: number[] = [0]
  for (let i = 1; i * segmentDuration < bgmDuration; i++) {
    timings.push(i * segmentDuration)
  }
  timings.push(bgmDuration)
  return timings
}

export async function analyzeBgm(
  bgmPath: string,
  options: AnalyzeOptions = {},
): Promise<AnalysisResult> {
  const bgmDuration = await probeAudioDuration(bgmPath)

  if (options.segmentDuration !== undefined) {
    const sectionTimings = fixedIntervalTimings(bgmDuration, options.segmentDuration)
    return {
      bpm: 0,
      sectionTimings,
      bgmDuration,
      sceneCount: sectionTimings.length - 1,
    }
  }

  const minGap = options.minSegmentDuration ?? DEFAULT_SEGMENT_DURATION

  try {
    const pcm = await extractPcm(bgmPath)
    const { ticks } = detectBeats(pcm)
    const bpm = bpmFromTicks(ticks)
    const sectionTimings = selectBeats(ticks, minGap, bgmDuration)

    return {
      bpm,
      sectionTimings,
      bgmDuration,
      sceneCount: sectionTimings.length - 1,
    }
  } catch (err) {
    console.warn('[analyze] beat detection failed, falling back to fixed-interval:', err)
    const sectionTimings = fixedIntervalTimings(bgmDuration, minGap)
    return {
      bpm: 0,
      sectionTimings,
      bgmDuration,
      sceneCount: sectionTimings.length - 1,
    }
  }
}
