import { describe, expect, it } from 'vitest'
import { assignTransitions, CUSTOM_TRANSITION_EXPRS, transitionDuration } from '../transitions'
import type { AnalysisResult, BeatInfo, MixStyle, TransitionEffect } from '@shared/types'
import type { Segment, SegmentPlan } from '../types'

function makePlan(timings: number[]): SegmentPlan {
  const segments: Segment[] = []
  for (let i = 0; i < timings.length - 1; i++) {
    segments.push({
      sourceIndex: i % 3,
      sourcePath: `/videos/v${i % 3}.mp4`,
      inpoint: i * 2,
      outpoint: i * 2 + (timings[i + 1]! - timings[i]!),
    })
  }
  return { segments, totalDuration: timings[timings.length - 1]! }
}

function makeBeats(times: number[], energies: number[]): BeatInfo[] {
  return times.map((time, i) => ({
    time,
    score: 0.5,
    energy: energies[i]!,
    onsetDistance: 0.05,
  }))
}

function makeAnalysis(overrides: Partial<AnalysisResult> & { sectionTimings: number[] }): AnalysisResult {
  return {
    bpm: 120,
    bgmDuration: overrides.sectionTimings[overrides.sectionTimings.length - 1]!,
    sceneCount: overrides.sectionTimings.length - 1,
    ...overrides,
  }
}

function assign(
  plan: SegmentPlan,
  analysis: AnalysisResult,
  density = 50,
  effect: TransitionEffect = 'circleopen',
  style: MixStyle = 'balanced',
) {
  return assignTransitions(plan, analysis, density, effect, style)
}

describe('assignTransitions', () => {
  it('returns empty array for single segment', () => {
    const plan = makePlan([0, 10])
    const analysis = makeAnalysis({
      sectionTimings: [0, 10],
      sections: [{ start: 0, end: 10, energy: 'medium' }],
      beats: makeBeats([1, 2, 3], [0.5, 0.5, 0.5]),
    })
    expect(assign(plan, analysis)).toEqual([])
  })

  it('returns all cuts when sections are absent', () => {
    const plan = makePlan([0, 3, 6, 9])
    const analysis = makeAnalysis({ sectionTimings: [0, 3, 6, 9] })
    const transitions = assign(plan, analysis)
    expect(transitions).toHaveLength(2)
    expect(transitions.every((t) => t.type === 'cut')).toBe(true)
  })

  it('returns all cuts when only one section', () => {
    const plan = makePlan([0, 3, 6, 9])
    const analysis = makeAnalysis({
      sectionTimings: [0, 3, 6, 9],
      sections: [{ start: 0, end: 9, energy: 'medium' }],
      beats: makeBeats([1, 3, 6], [0.5, 0.5, 0.5]),
    })
    expect(assign(plan, analysis).every((t) => t.type === 'cut')).toBe(true)
  })

  it('returns all cuts at density 0', () => {
    const plan = makePlan([0, 5, 10, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 15, energy: 'high' },
      ],
      beats: makeBeats([5, 10, 12], [0.3, 0.4, 0.5]),
    })
    const transitions = assign(plan, analysis, 0)
    expect(transitions.every((t) => t.type === 'cut')).toBe(true)
  })

  it('assigns the chosen effect type to all transition points at density 100', () => {
    const plan = makePlan([0, 5, 10, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 15, energy: 'high' },
      ],
      beats: makeBeats([5, 10, 12], [0.3, 0.4, 0.5]),
    })
    const transitions = assign(plan, analysis, 100, 'fadewhite')
    const nonCuts = transitions.filter((t) => t.type !== 'cut')
    expect(nonCuts.length).toBeGreaterThan(0)
    for (const t of nonCuts) {
      if (t.type !== 'flash') {
        expect(t.type).toBe('fadewhite')
      }
    }
  })

  it('uses a single transition type for the whole mix', () => {
    const plan = makePlan([0, 3, 6, 9, 12, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 3, 6, 9, 12, 15],
      sections: [
        { start: 0, end: 9, energy: 'medium' },
        { start: 9, end: 15, energy: 'high' },
      ],
      beats: makeBeats([3, 6, 9, 12], [0.4, 0.5, 0.7, 0.6]),
    })
    const transitions = assign(plan, analysis, 100, 'horzopen')
    const types = new Set(transitions.filter((t) => t.type !== 'cut' && t.type !== 'flash').map((t) => t.type))
    expect(types.size).toBe(1)
    expect(types.has('horzopen')).toBe(true)
  })

  it('section boundaries get transitions before regular beats', () => {
    const plan = makePlan([0, 5, 10, 15, 20, 25])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15, 20, 25],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 25, energy: 'high' },
      ],
      beats: makeBeats([5, 10, 15, 20], [0.3, 0.5, 0.5, 0.5]),
    })
    const transitions = assign(plan, analysis, 25)
    const transitioned = transitions.map((t, i) => ({ i, type: t.type })).filter((t) => t.type !== 'cut')
    expect(transitioned.length).toBe(1)
    expect(transitioned[0]!.i).toBe(1)
  })

  it('assigns flash at high energy delta after low-energy section', () => {
    const plan = makePlan([0, 4, 8, 12])
    const analysis = makeAnalysis({
      sectionTimings: [0, 4, 8, 12],
      sections: [
        { start: 0, end: 8, energy: 'low' },
        { start: 8, end: 12, energy: 'high' },
      ],
      beats: makeBeats([2, 4, 6, 8, 10], [0.1, 0.1, 0.1, 1.0, 0.9]),
    })
    const transitions = assign(plan, analysis, 100)
    const flashIdx = transitions.findIndex((t) => t.type === 'flash')
    expect(flashIdx).toBeGreaterThanOrEqual(0)
    expect(transitions[flashIdx]!.duration).toBe(0.06)
  })

  it('returns all cuts when beats are absent', () => {
    const plan = makePlan([0, 5, 10])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10],
      sections: [
        { start: 0, end: 5, energy: 'low' },
        { start: 5, end: 10, energy: 'high' },
      ],
    })
    const transitions = assign(plan, analysis, 100)
    expect(transitions.every((t) => t.type === 'cut')).toBe(true)
  })

  it('chill style produces longer durations than hyperkinetic', () => {
    const plan = makePlan([0, 5, 10, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 15, energy: 'high' },
      ],
      beats: makeBeats([5, 10, 12], [0.3, 0.4, 0.5]),
    })
    const chillTransitions = assign(plan, analysis, 100, 'circleopen', 'chill')
    const hyperTransitions = assign(plan, analysis, 100, 'circleopen', 'hyperkinetic')

    const chillDurations = chillTransitions.filter((t) => t.type !== 'cut' && t.type !== 'flash')
    const hyperDurations = hyperTransitions.filter((t) => t.type !== 'cut' && t.type !== 'flash')

    expect(chillDurations.length).toBeGreaterThan(0)
    expect(hyperDurations.length).toBeGreaterThan(0)
    const avgChill = chillDurations.reduce((s, t) => s + t.duration, 0) / chillDurations.length
    const avgHyper = hyperDurations.reduce((s, t) => s + t.duration, 0) / hyperDurations.length
    expect(avgChill).toBeGreaterThan(avgHyper)
  })

  it('transitions have positive durations', () => {
    const plan = makePlan([0, 3, 6, 9, 12, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 3, 6, 9, 12, 15],
      sections: [
        { start: 0, end: 9, energy: 'medium' },
        { start: 9, end: 15, energy: 'high' },
      ],
      beats: makeBeats([3, 6, 9, 12], [0.4, 0.5, 0.7, 0.6]),
    })
    const transitions = assign(plan, analysis, 100)
    for (const t of transitions) {
      if (t.type === 'cut') {
        expect(t.duration).toBe(0)
      } else {
        expect(t.duration).toBeGreaterThan(0)
      }
    }
  })
})

describe('transitionDuration', () => {
  it('returns 0 for cut', () => {
    expect(transitionDuration('cut', 'balanced')).toBe(0)
  })

  it('scales by style', () => {
    const chill = transitionDuration('circleopen', 'chill')
    const balanced = transitionDuration('circleopen', 'balanced')
    const hyper = transitionDuration('circleopen', 'hyperkinetic')
    expect(chill).toBeGreaterThan(balanced)
    expect(balanced).toBeGreaterThan(hyper)
  })
})

describe('CUSTOM_TRANSITION_EXPRS', () => {
  it('has expressions for all custom types', () => {
    expect(CUSTOM_TRANSITION_EXPRS.acid).toBeDefined()
    expect(CUSTOM_TRANSITION_EXPRS.doublevision).toBeDefined()
    expect(CUSTOM_TRANSITION_EXPRS.solarize).toBeDefined()
    expect(CUSTOM_TRANSITION_EXPRS.strobe).toBeDefined()
    expect(CUSTOM_TRANSITION_EXPRS.strobe_white).toBeDefined()
  })

  it('does not have expressions for built-in types', () => {
    expect(CUSTOM_TRANSITION_EXPRS.circleopen).toBeUndefined()
    expect(CUSTOM_TRANSITION_EXPRS.fadewhite).toBeUndefined()
  })
})
