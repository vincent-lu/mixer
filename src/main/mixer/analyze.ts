import type { AnalysisResult, BeatInfo, Section } from '@shared/types'
import { extractPcm, detectBeats, detectOnsets, computePerBeatEnergy } from './audio'
import { probeAudioDuration } from './probe'

export const DEFAULT_SEGMENT_DURATION = 0.5

export interface AnalyzeOptions {
  segmentDuration?: number
  minSegmentDuration?: number
}

const BEAT_TOLERANCE = 0.02
const SAMPLE_RATE = 44100
const SECTION_HOP = 0.5
const SECTION_WINDOW = 1.0
const MIN_SECTION_DURATION = 1.5
const SCORED_LOOKAHEAD = 2.0

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

export function detectSections(pcm: Float32Array, bgmDuration: number): Section[] {
  const hopSamples = Math.round(SECTION_HOP * SAMPLE_RATE)
  const windowSamples = Math.round(SECTION_WINDOW * SAMPLE_RATE)

  const rmsValues: number[] = []
  const windowTimes: number[] = []
  for (let offset = 0; offset + windowSamples <= pcm.length; offset += hopSamples) {
    let sumSq = 0
    for (let i = offset; i < offset + windowSamples; i++) {
      sumSq += pcm[i]! * pcm[i]!
    }
    rmsValues.push(Math.sqrt(sumSq / windowSamples))
    windowTimes.push(offset / SAMPLE_RATE)
  }

  if (rmsValues.length === 0) return [{ start: 0, end: bgmDuration, energy: 'medium' }]

  const minRms = Math.min(...rmsValues)
  const maxRms = Math.max(...rmsValues)
  const range = maxRms - minRms

  if (range === 0) return [{ start: 0, end: bgmDuration, energy: 'medium' }]

  const lowThreshold = minRms + range / 3
  const highThreshold = minRms + (2 * range) / 3

  function classify(rms: number): Section['energy'] {
    if (rms < lowThreshold) return 'low'
    if (rms >= highThreshold) return 'high'
    return 'medium'
  }

  const sections: Section[] = []
  let currentEnergy = classify(rmsValues[0]!)
  let sectionStart = 0

  for (let i = 1; i < rmsValues.length; i++) {
    const energy = classify(rmsValues[i]!)
    if (energy !== currentEnergy) {
      sections.push({ start: sectionStart, end: windowTimes[i]!, energy: currentEnergy })
      sectionStart = windowTimes[i]!
      currentEnergy = energy
    }
  }
  sections.push({ start: sectionStart, end: bgmDuration, energy: currentEnergy })

  const merged: Section[] = [{ ...sections[0]! }]
  for (let i = 1; i < sections.length; i++) {
    const s = sections[i]!
    if (s.end - s.start < MIN_SECTION_DURATION) {
      merged[merged.length - 1]!.end = s.end
    } else {
      merged.push({ ...s })
    }
  }

  if (merged.length > 1 && merged[0]!.end - merged[0]!.start < MIN_SECTION_DURATION) {
    merged[1]!.start = merged[0]!.start
    merged.shift()
  }

  return merged
}

function nearestDistance(target: number, sorted: number[]): number {
  if (sorted.length === 0) return Infinity
  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]! < target) lo = mid + 1
    else hi = mid
  }
  let best = Math.abs(sorted[lo]! - target)
  if (lo > 0) best = Math.min(best, Math.abs(sorted[lo - 1]! - target))
  return best
}

export function scoreBeats(ticks: number[], onsets: number[], beatEnergy: number[]): BeatInfo[] {
  const sortedOnsets = [...onsets].sort((a, b) => a - b)
  const maxEnergy = beatEnergy.length > 0 ? Math.max(...beatEnergy) : 0
  if (maxEnergy === 0) {
    return ticks.map((time) => ({
      time,
      score: 0,
      energy: 0,
      onsetDistance: nearestDistance(time, sortedOnsets),
    }))
  }

  return ticks.map((time, i) => {
    const onsetDistance = nearestDistance(time, sortedOnsets)
    const onsetScore = Math.max(0, 1 - onsetDistance / 0.2)
    const energyScore = beatEnergy[i]! / maxEnergy
    const prevEnergy = i > 0 ? beatEnergy[i - 1]! : beatEnergy[i]!
    const energyDelta = Math.abs(beatEnergy[i]! - prevEnergy) / maxEnergy
    const score = onsetScore * 0.4 + energyScore * 0.35 + energyDelta * 0.25

    return { time, score, energy: beatEnergy[i]!, onsetDistance }
  })
}

export function selectScoredBeats(beats: BeatInfo[], minGap: number, bgmDuration: number): number[] {
  const timings: number[] = [0]
  const threshold = minGap - BEAT_TOLERANCE
  let idx = 0

  while (idx < beats.length) {
    const lastSwitch = timings[timings.length - 1]!
    const windowStart = lastSwitch + threshold
    const windowEnd = lastSwitch + minGap + SCORED_LOOKAHEAD

    while (idx < beats.length && beats[idx]!.time < windowStart) idx++
    if (idx >= beats.length || beats[idx]!.time >= bgmDuration) break

    let bestIdx = idx
    for (
      let i = idx + 1;
      i < beats.length && beats[i]!.time <= windowEnd && beats[i]!.time < bgmDuration;
      i++
    ) {
      if (beats[i]!.score > beats[bestIdx]!.score) bestIdx = i
    }

    timings.push(beats[bestIdx]!.time)
    idx = bestIdx + 1
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

    const onsets = detectOnsets(pcm)
    const beatEnergy = computePerBeatEnergy(pcm, ticks)
    const beats = scoreBeats(ticks, onsets, beatEnergy)
    const sections = detectSections(pcm, bgmDuration)
    const sectionTimings = selectScoredBeats(beats, minGap, bgmDuration)

    return {
      bpm,
      sectionTimings,
      bgmDuration,
      sceneCount: sectionTimings.length - 1,
      beats,
      onsets,
      sections,
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
