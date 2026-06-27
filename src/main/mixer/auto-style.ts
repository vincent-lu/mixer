import type {
  AnalysisResult,
  ClipEffect,
  MixStyle,
  Section,
  TransitionEffect,
} from '../../shared/types'
import { DEFAULT_STYLE_LOOKAHEAD } from '../../shared/types'

export interface ResolvedStyle {
  mixStyle: MixStyle
  lookahead: number
  transitionEffect: TransitionEffect
  transitionDensity: number
  clipEffect: ClipEffect
  effectChance: number
  intensityScore: number
}

interface StyleTier {
  maxScore: number
  mixStyle: MixStyle
  transitionEffect: TransitionEffect
  transitionDensity: number
  clipEffect: ClipEffect
  effectChance: number
}

const STYLE_TIERS: StyleTier[] = [
  { maxScore: 0.14, mixStyle: 'chill', transitionEffect: 'fadewhite', transitionDensity: 15, clipEffect: 'kenburns', effectChance: 30 },
  { maxScore: 0.28, mixStyle: 'relaxed', transitionEffect: 'fadewhite', transitionDensity: 20, clipEffect: 'drift', effectChance: 25 },
  { maxScore: 0.42, mixStyle: 'balanced', transitionEffect: 'circleopen', transitionDensity: 30, clipEffect: 'none', effectChance: 0 },
  { maxScore: 0.57, mixStyle: 'energetic', transitionEffect: 'horzopen', transitionDensity: 40, clipEffect: 'zoompulse', effectChance: 35 },
  { maxScore: 0.71, mixStyle: 'hyperkinetic', transitionEffect: 'acid', transitionDensity: 50, clipEffect: 'shake', effectChance: 45 },
  { maxScore: 0.85, mixStyle: 'frenetic', transitionEffect: 'strobe', transitionDensity: 60, clipEffect: 'shake_hard', effectChance: 55 },
  { maxScore: Infinity, mixStyle: 'chaos', transitionEffect: 'strobe_white', transitionDensity: 70, clipEffect: 'chromatic', effectChance: 65 },
]

function computeWeightedEnergy(sections: Section[], bgmDuration: number): number {
  if (sections.length === 0 || bgmDuration <= 0) return 0.5

  const energyValues = { low: 0, medium: 0.5, high: 1.0 }
  let weightedSum = 0
  let totalDuration = 0

  for (const section of sections) {
    const duration = section.end - section.start
    weightedSum += duration * energyValues[section.energy]
    totalDuration += duration
  }

  if (totalDuration <= 0) return 0.5
  return weightedSum / totalDuration
}

function energyToMultiplier(weightedEnergy: number): number {
  if (weightedEnergy < 0.25) return 0.7
  if (weightedEnergy < 0.5) return 0.9
  if (weightedEnergy < 0.75) return 1.1
  return 1.4
}

export function computeIntensityScore(
  bpm: number,
  sections: Section[],
  bgmDuration: number,
  intensityBias: number,
): number {
  const safeBpm = Number.isFinite(bpm) ? bpm : 0
  const bpmScore = Math.max(0, Math.min(1, (safeBpm - 60) / 140))
  const weightedEnergy = computeWeightedEnergy(sections, bgmDuration)
  const energyMult = energyToMultiplier(weightedEnergy)
  return Math.max(0, Math.min(1, bpmScore * energyMult * intensityBias))
}

export function resolveAutoStyle(
  analysis: AnalysisResult,
  intensityBias: number = 1.0,
): ResolvedStyle {
  const sections = analysis.sections ?? []
  const score = computeIntensityScore(
    analysis.bpm,
    sections,
    analysis.bgmDuration,
    intensityBias,
  )

  const tier = STYLE_TIERS.find((t) => score <= t.maxScore)!

  return {
    mixStyle: tier.mixStyle,
    lookahead: DEFAULT_STYLE_LOOKAHEAD[tier.mixStyle],
    transitionEffect: tier.transitionEffect,
    transitionDensity: tier.transitionDensity,
    clipEffect: tier.clipEffect,
    effectChance: tier.effectChance,
    intensityScore: score,
  }
}
