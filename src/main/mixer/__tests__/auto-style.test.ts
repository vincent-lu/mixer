import { describe, expect, it } from 'vitest'
import { computeIntensityScore, resolveAutoStyle } from '../auto-style'
import { DEFAULT_STYLE_LOOKAHEAD } from '../../../shared/types'
import type { AnalysisResult, Section } from '../../../shared/types'

function makeAnalysis(
  bpm: number,
  sections: Section[] = [],
  bgmDuration = 180,
): AnalysisResult {
  return {
    bpm,
    sectionTimings: [],
    bgmDuration,
    sceneCount: 10,
    sections,
  }
}

function makeSections(energy: 'low' | 'medium' | 'high', duration = 180): Section[] {
  return [{ start: 0, end: duration, energy }]
}

describe('computeIntensityScore', () => {
  it('returns 0 for very low BPM with low energy', () => {
    const score = computeIntensityScore(60, makeSections('low'), 180, 1.0)
    expect(score).toBe(0)
  })

  it('returns 1 clamped for high BPM with high energy and max bias', () => {
    const score = computeIntensityScore(200, makeSections('high'), 180, 2.0)
    expect(score).toBe(1)
  })

  it('BPM normalization is linear', () => {
    // Use low energy sections (multiplier 0.7) to isolate BPM effect
    const low = makeSections('low')
    const score60 = computeIntensityScore(60, low, 180, 1.0)
    const score130 = computeIntensityScore(130, low, 180, 1.0)
    const score200 = computeIntensityScore(200, low, 180, 1.0)
    expect(score60).toBe(0)
    // 130 BPM: (130-60)/140 = 0.5, × 0.7 = 0.35
    expect(score130).toBeCloseTo(0.35, 2)
    // 200 BPM: (200-60)/140 = 1.0, × 0.7 = 0.7
    expect(score200).toBeCloseTo(0.7, 2)
  })

  it('energy multiplier affects score', () => {
    const low = computeIntensityScore(120, makeSections('low'), 180, 1.0)
    const high = computeIntensityScore(120, makeSections('high'), 180, 1.0)
    expect(high).toBeGreaterThan(low)
    expect(high / low).toBeCloseTo(1.4 / 0.7, 1)
  })

  it('intensity bias scales linearly', () => {
    const base = computeIntensityScore(120, makeSections('medium'), 180, 1.0)
    const boosted = computeIntensityScore(120, makeSections('medium'), 180, 1.5)
    expect(boosted / base).toBeCloseTo(1.5, 1)
  })

  it('handles empty sections with default energy', () => {
    const score = computeIntensityScore(130, [], 180, 1.0)
    // BPM score (130-60)/140 = 0.5; empty sections → weightedEnergy 0.5 → mult 1.1
    expect(score).toBeCloseTo(0.5 * 1.1, 2)
  })
})

describe('resolveAutoStyle', () => {
  it('resolves chill for slow low-energy track', () => {
    const result = resolveAutoStyle(makeAnalysis(70, makeSections('low')))
    expect(result.mixStyle).toBe('chill')
    expect(result.transitionEffect).toBe('fadewhite')
    expect(result.clipEffect).toBe('kenburns')
  })

  it('resolves energetic for moderate BPM and medium energy', () => {
    // 120 BPM: score 0.429, medium energy (weighted 0.5) → multiplier 1.1
    // composite: 0.429 × 1.1 = 0.472 → energetic (0.43–0.57)
    const result = resolveAutoStyle(makeAnalysis(120, makeSections('medium')))
    expect(result.mixStyle).toBe('energetic')
  })

  it('resolves energetic+ for moderate BPM with high energy', () => {
    const result = resolveAutoStyle(makeAnalysis(120, makeSections('high')))
    const intenseStyles = ['energetic', 'hyperkinetic', 'frenetic', 'chaos']
    expect(intenseStyles).toContain(result.mixStyle)
  })

  it('intensity bias pushes toward more intense styles', () => {
    const base = resolveAutoStyle(makeAnalysis(120, makeSections('medium')), 1.0)
    const boosted = resolveAutoStyle(makeAnalysis(120, makeSections('medium')), 1.8)
    const styles = ['chill', 'relaxed', 'balanced', 'energetic', 'hyperkinetic', 'frenetic', 'chaos']
    expect(styles.indexOf(boosted.mixStyle)).toBeGreaterThan(styles.indexOf(base.mixStyle))
  })

  it('intensity bias pulls toward calmer styles', () => {
    const base = resolveAutoStyle(makeAnalysis(140, makeSections('high')), 1.0)
    const calmed = resolveAutoStyle(makeAnalysis(140, makeSections('high')), 0.5)
    const styles = ['chill', 'relaxed', 'balanced', 'energetic', 'hyperkinetic', 'frenetic', 'chaos']
    expect(styles.indexOf(calmed.mixStyle)).toBeLessThan(styles.indexOf(base.mixStyle))
  })

  it('lookahead matches resolved style', () => {
    const result = resolveAutoStyle(makeAnalysis(120, makeSections('medium')))
    expect(result.lookahead).toBe(DEFAULT_STYLE_LOOKAHEAD[result.mixStyle])
  })

  it('includes intensity score in result', () => {
    const result = resolveAutoStyle(makeAnalysis(130, makeSections('high')), 1.0)
    expect(result.intensityScore).toBeGreaterThan(0)
    expect(result.intensityScore).toBeLessThanOrEqual(1)
  })

  it('handles mixed energy sections weighted by duration', () => {
    const sections: Section[] = [
      { start: 0, end: 60, energy: 'low' },
      { start: 60, end: 180, energy: 'high' },
    ]
    // 1/3 low + 2/3 high → weighted ~0.67 → multiplier 1.1
    const result = resolveAutoStyle(makeAnalysis(130, sections))
    expect(result.intensityScore).toBeGreaterThan(0.5)
  })
})
