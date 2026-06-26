import type { AnalysisResult, BeatInfo, Section } from '@shared/types'
import type { SegmentPlan, TransitionType } from './types'

export const DISSOLVE_DURATION = 0.4
export const FLASH_FADE_DURATION = 0.06

const SECTION_BOUNDARY_TOLERANCE = 0.5
const ENERGY_DELTA_THRESHOLD = 0.3

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

function findSectionAt(sections: Section[], time: number): Section | undefined {
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i]!.start <= time) return sections[i]!
  }
  return sections[0]
}

function isSectionBoundary(sections: Section[], time: number): boolean {
  for (let i = 0; i < sections.length - 1; i++) {
    const boundary = sections[i]!.end
    if (Math.abs(boundary - time) <= SECTION_BOUNDARY_TOLERANCE) {
      if (sections[i]!.energy !== sections[i + 1]!.energy) return true
    }
  }
  return false
}

function isFlashCandidate(beats: BeatInfo[], time: number, sections: Section[]): boolean {
  if (beats.length < 2) return false

  const idx = findNearestBeatIndex(beats, time)
  if (Math.abs(beats[idx]!.time - time) > SECTION_BOUNDARY_TOLERANCE) return false

  const beat = beats[idx]!
  const maxEnergy = Math.max(...beats.map((b) => b.energy))
  if (maxEnergy === 0) return false

  const normalizedEnergy = beat.energy / maxEnergy
  const prevIdx = idx > 0 ? idx - 1 : 0
  const prevNormalized = beats[prevIdx]!.energy / maxEnergy
  const delta = normalizedEnergy - prevNormalized

  if (delta < ENERGY_DELTA_THRESHOLD) return false

  const section = findSectionAt(sections, time)
  const prevSection = findSectionAt(sections, beats[prevIdx]!.time)
  return prevSection?.energy === 'low' || (prevSection?.energy === 'medium' && section?.energy === 'high')
}

export function assignTransitions(
  plan: SegmentPlan,
  analysis: AnalysisResult,
): TransitionType[] {
  const { segments } = plan
  if (segments.length <= 1) return []

  const { sections, beats, sectionTimings } = analysis
  const count = segments.length - 1

  if (!sections || sections.length <= 1 || !beats || beats.length < 2) {
    return new Array<TransitionType>(count).fill('cut')
  }

  const transitions: TransitionType[] = []

  for (let i = 0; i < count; i++) {
    const t = sectionTimings[i + 1]!

    if (isFlashCandidate(beats, t, sections)) {
      transitions.push('flash')
    } else if (isSectionBoundary(sections, t)) {
      transitions.push('dissolve')
    } else {
      transitions.push('cut')
    }
  }

  return transitions
}
