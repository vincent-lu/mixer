import type { AnalysisResult, BeatInfo, MixStyle, Section, TransitionEffect } from '@shared/types'
import type { SegmentPlan, TransitionAssignment } from './types'

export const FLASH_FADE_DURATION = 0.06

const SECTION_BOUNDARY_TOLERANCE = 1.0
const ENERGY_DELTA_THRESHOLD = 0.3

const STYLE_DURATION_SCALE: Record<MixStyle, number> = {
  chill: 1.5,
  relaxed: 1.2,
  balanced: 1.0,
  energetic: 0.7,
  hyperkinetic: 0.5,
}

const BASE_DURATIONS: Record<Exclude<TransitionEffect, 'cut'>, number> = {
  circleopen: 0.6,
  fadewhite: 0.8,
  horzopen: 0.6,
  vertopen: 0.6,
  acid: 1.2,
  doublevision: 1.2,
  solarize: 1.0,
  strobe: 0.8,
  strobe_white: 0.8,
}

export const CUSTOM_TRANSITION_EXPRS: Partial<Record<TransitionEffect, string>> = {
  acid: "A*(1-P)+B*P+80*sin(X/30+P*15)*sin(Y/25+P*12)*sin(P*20)*(1-abs(P-0.5)*2)",
  doublevision: "A*(0.5+0.4*sin(P*12)*(1-P))+B*(0.5-0.4*sin(P*12)*P)",
  solarize: "clip(abs((A*(1-P)+B*P)-128*(1-abs(P-0.5)*2)*2+128*(1-abs(P-0.5)*2)),0,255)",
  strobe: "if(gt(sin(P*40),0),if(gt(P,0.5),B,A),0)",
  strobe_white: "if(gt(sin(P*40),0),if(gt(P,0.5),B,A),255)",
}

export function transitionDuration(effect: TransitionEffect, style: MixStyle): number {
  if (effect === 'cut') return 0
  return BASE_DURATIONS[effect] * STYLE_DURATION_SCALE[style]
}

function findSectionAt(sections: Section[], time: number): Section | undefined {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i]!.start <= time) return sections[i]!
  }
  return sections[0]
}

function isSectionBoundaryWithEnergyChange(sections: Section[], time: number): boolean {
  for (let i = 0; i < sections.length - 1; i++) {
    const boundary = sections[i]!.end
    if (Math.abs(boundary - time) <= SECTION_BOUNDARY_TOLERANCE) {
      if (sections[i]!.energy !== sections[i + 1]!.energy) return true
    }
  }
  return false
}

function findNearestBeatIndex(beats: BeatInfo[], time: number): number {
  let bestIdx = 0
  let bestDist = Math.abs(beats[0]!.time - time)
  for (let i = 1; i < beats.length; i++) {
    const dist = Math.abs(beats[i]!.time - time)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
    if (beats[i]!.time > time + SECTION_BOUNDARY_TOLERANCE) break
  }
  return bestIdx
}

function isFlashCandidate(beats: BeatInfo[], time: number, sections: Section[], maxEnergy: number): boolean {
  if (beats.length < 2 || maxEnergy === 0) return false

  const idx = findNearestBeatIndex(beats, time)
  if (Math.abs(beats[idx]!.time - time) > SECTION_BOUNDARY_TOLERANCE) return false

  const beat = beats[idx]!
  const normalizedEnergy = beat.energy / maxEnergy
  const prevIdx = idx > 0 ? idx - 1 : 0
  const prevNormalized = beats[prevIdx]!.energy / maxEnergy
  const delta = normalizedEnergy - prevNormalized

  if (delta < ENERGY_DELTA_THRESHOLD) return false

  const section = findSectionAt(sections, time)
  const prevSection = findSectionAt(sections, beats[prevIdx]!.time)
  return prevSection?.energy === 'low' || (prevSection?.energy === 'medium' && section?.energy === 'high')
}

function scoreWorthiness(
  time: number,
  beats: BeatInfo[],
  sections: Section[],
  scoreThreshold: number,
): number {
  if (isSectionBoundaryWithEnergyChange(sections, time)) return 1.0

  const idx = findNearestBeatIndex(beats, time)
  if (Math.abs(beats[idx]!.time - time) <= SECTION_BOUNDARY_TOLERANCE) {
    if (beats[idx]!.score >= scoreThreshold) return 0.6
  }

  return 0.2
}

export function assignTransitions(
  plan: SegmentPlan,
  analysis: AnalysisResult,
  density: number,
  effect: TransitionEffect,
  style: MixStyle,
): TransitionAssignment[] {
  const { segments } = plan
  const count = segments.length - 1
  if (count <= 0) return []

  const { sections, beats, sectionTimings } = analysis

  if (!sections || sections.length <= 1 || !beats || beats.length < 2) {
    return Array.from({ length: count }, () => ({ type: 'cut' as const, duration: 0 }))
  }

  if (density <= 0) {
    return Array.from({ length: count }, () => ({ type: 'cut' as const, duration: 0 }))
  }

  const scores = beats.map((b) => b.score)
  scores.sort((a, b) => b - a)
  const highScoreIdx = Math.floor(scores.length * 0.25)
  const highScoreThreshold = scores[highScoreIdx] ?? 0

  const indexed: { idx: number; worthiness: number }[] = []
  for (let i = 0; i < count; i++) {
    const t = sectionTimings[i + 1]!
    const w = scoreWorthiness(t, beats, sections, highScoreThreshold)
    indexed.push({ idx: i, worthiness: w })
  }

  indexed.sort((a, b) => b.worthiness - a.worthiness || a.idx - b.idx)

  const numTransitions = Math.round((density / 100) * count)
  const selectedSet = new Set<number>()
  for (let i = 0; i < Math.min(numTransitions, indexed.length); i++) {
    selectedSet.add(indexed[i]!.idx)
  }

  const maxEnergy = Math.max(...beats.map((b) => b.energy))
  const dur = transitionDuration(effect, style)
  const result: TransitionAssignment[] = []

  for (let i = 0; i < count; i++) {
    if (!selectedSet.has(i)) {
      result.push({ type: 'cut', duration: 0 })
      continue
    }

    const t = sectionTimings[i + 1]!

    if (isFlashCandidate(beats, t, sections, maxEnergy)) {
      result.push({ type: 'flash', duration: FLASH_FADE_DURATION })
      continue
    }

    result.push({ type: effect, duration: dur })
  }

  return result
}
