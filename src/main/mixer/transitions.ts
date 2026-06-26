import type { AnalysisResult, BeatInfo, MixStyle, Section, TransitionPalette } from '@shared/types'
import type { SegmentPlan, TransitionAssignment } from './types'

export const FLASH_FADE_DURATION = 0.06

const SECTION_BOUNDARY_TOLERANCE = 1.0
const ENERGY_DELTA_THRESHOLD = 0.3

const SUBTLE_TYPES = ['fade', 'dissolve', 'fadeblack', 'fadewhite', 'fadeslow']
const DYNAMIC_TYPES = [
  'wipeleft', 'wiperight', 'slideleft', 'slideright',
  'smoothleft', 'smoothright', 'coverleft', 'coverright',
  'revealleft', 'revealright',
]
const CINEMATIC_TYPES = [
  'circleopen', 'circleclose', 'radial', 'zoomin',
  'vertopen', 'vertclose', 'horzopen', 'horzclose',
]
const AGGRESSIVE_TYPES = [
  'pixelize', 'hblur', 'hlwind', 'hrwind',
  'diagtl', 'diagtr', 'diagbl', 'diagbr',
  'squeezeh', 'squeezev', 'hlslice', 'hrslice',
]

const PALETTE_TIERS: Record<TransitionPalette, string[]> = {
  subtle: SUBTLE_TYPES,
  dynamic: [...SUBTLE_TYPES, ...DYNAMIC_TYPES],
  cinematic: [...SUBTLE_TYPES, ...DYNAMIC_TYPES, ...CINEMATIC_TYPES],
  aggressive: [...SUBTLE_TYPES, ...DYNAMIC_TYPES, ...CINEMATIC_TYPES, ...AGGRESSIVE_TYPES],
}

interface DurationCategory {
  base: [number, number]
  types: Set<string>
}

const DURATION_CATEGORIES: DurationCategory[] = [
  { base: [0.4, 0.5], types: new Set([...AGGRESSIVE_TYPES, 'wipeleft', 'wiperight', 'slideleft', 'slideright']) },
  { base: [0.6, 0.8], types: new Set([...CINEMATIC_TYPES, 'coverleft', 'coverright', 'revealleft', 'revealright', 'smoothleft', 'smoothright']) },
  { base: [0.8, 1.2], types: new Set(SUBTLE_TYPES) },
]

const STYLE_DURATION_SCALE: Record<MixStyle, number> = {
  chill: 1.5,
  relaxed: 1.2,
  balanced: 1.0,
  energetic: 0.7,
  hyperkinetic: 0.5,
}

function getBaseDuration(type: string): number {
  for (const cat of DURATION_CATEGORIES) {
    if (cat.types.has(type)) {
      return (cat.base[0] + cat.base[1]) / 2
    }
  }
  return 0.6
}

function scaledDuration(type: string, style: MixStyle): number {
  return getBaseDuration(type) * STYLE_DURATION_SCALE[style]
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

function pickTypeForContext(
  time: number,
  sections: Section[],
  beats: BeatInfo[],
  availableTypes: string[],
  maxEnergy: number,
): string {
  const section = findSectionAt(sections, time)
  const energy = section?.energy ?? 'medium'

  let preferred: string[]
  if (isSectionBoundaryWithEnergyChange(sections, time)) {
    preferred = availableTypes.filter((t) =>
      DYNAMIC_TYPES.includes(t) || CINEMATIC_TYPES.includes(t),
    )
  } else if (energy === 'high') {
    const idx = findNearestBeatIndex(beats, time)
    const beat = beats[idx]
    const normalizedEnergy = beat && maxEnergy > 0 ? beat.energy / maxEnergy : 0
    if (normalizedEnergy > 0.7) {
      preferred = availableTypes.filter((t) =>
        CINEMATIC_TYPES.includes(t) || AGGRESSIVE_TYPES.includes(t),
      )
    } else {
      preferred = availableTypes.filter((t) => DYNAMIC_TYPES.includes(t))
    }
  } else {
    preferred = availableTypes.filter((t) => SUBTLE_TYPES.includes(t))
  }

  const pool = preferred.length > 0 ? preferred : availableTypes
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function assignTransitions(
  plan: SegmentPlan,
  analysis: AnalysisResult,
  density: number,
  palette: TransitionPalette,
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

  const availableTypes = PALETTE_TIERS[palette]
  const maxEnergy = Math.max(...beats.map((b) => b.energy))
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

    const xfadeType = pickTypeForContext(t, sections, beats, availableTypes, maxEnergy)
    result.push({ type: xfadeType, duration: scaledDuration(xfadeType, style) })
  }

  return result
}
