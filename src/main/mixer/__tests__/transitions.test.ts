import { describe, expect, it } from 'vitest'
import { assignTransitions } from '../transitions'
import type { AnalysisResult, BeatInfo } from '@shared/types'
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

describe('assignTransitions', () => {
  it('returns empty array for single segment', () => {
    const plan = makePlan([0, 10])
    const analysis = makeAnalysis({
      sectionTimings: [0, 10],
      sections: [{ start: 0, end: 10, energy: 'medium' }],
      beats: makeBeats([1, 2, 3], [0.5, 0.5, 0.5]),
    })
    expect(assignTransitions(plan, analysis)).toEqual([])
  })

  it('returns all cuts when sections are absent', () => {
    const plan = makePlan([0, 3, 6, 9])
    const analysis = makeAnalysis({ sectionTimings: [0, 3, 6, 9] })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions).toEqual(['cut', 'cut'])
  })

  it('returns all cuts when only one section', () => {
    const plan = makePlan([0, 3, 6, 9])
    const analysis = makeAnalysis({
      sectionTimings: [0, 3, 6, 9],
      sections: [{ start: 0, end: 9, energy: 'medium' }],
      beats: makeBeats([1, 3, 6], [0.5, 0.5, 0.5]),
    })
    expect(assignTransitions(plan, analysis)).toEqual(['cut', 'cut'])
  })

  it('assigns dissolve at section boundary with energy change', () => {
    // 3 segments: [0-5], [5-10], [10-15]. Section boundary at t=10 with energy change.
    const plan = makePlan([0, 5, 10, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 15, energy: 'high' },
      ],
      beats: makeBeats([5, 10, 12], [0.3, 0.4, 0.5]),
    })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions).toHaveLength(2)
    expect(transitions[0]).toBe('cut')
    expect(transitions[1]).toBe('dissolve')
  })

  it('does not dissolve when energy is the same across section boundary', () => {
    const plan = makePlan([0, 5, 10, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10, 15],
      sections: [
        { start: 0, end: 10, energy: 'medium' },
        { start: 10, end: 15, energy: 'medium' },
      ],
      beats: makeBeats([5, 10, 12], [0.5, 0.5, 0.5]),
    })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions).toEqual(['cut', 'cut'])
  })

  it('assigns flash at high energy delta after low-energy section', () => {
    const plan = makePlan([0, 4, 8, 12])
    const analysis = makeAnalysis({
      sectionTimings: [0, 4, 8, 12],
      sections: [
        { start: 0, end: 8, energy: 'low' },
        { start: 8, end: 12, energy: 'high' },
      ],
      // Beat at t=8 has huge energy spike vs previous
      beats: makeBeats([2, 4, 6, 8, 10], [0.1, 0.1, 0.1, 1.0, 0.9]),
    })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions[1]).toBe('flash')
  })

  it('flash takes priority over dissolve when both conditions match', () => {
    const plan = makePlan([0, 5, 10])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 10],
      sections: [
        { start: 0, end: 5, energy: 'low' },
        { start: 5, end: 10, energy: 'high' },
      ],
      // Section boundary at t=5 with energy change (dissolve candidate)
      // AND beat at t=5 with huge delta (flash candidate)
      beats: makeBeats([2, 5, 8], [0.1, 1.0, 0.8]),
    })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions[0]).toBe('flash')
  })

  it('handles section boundary within tolerance', () => {
    const plan = makePlan([0, 5, 9.8, 15])
    const analysis = makeAnalysis({
      sectionTimings: [0, 5, 9.8, 15],
      sections: [
        { start: 0, end: 10, energy: 'low' },
        { start: 10, end: 15, energy: 'high' },
      ],
      beats: makeBeats([5, 9.8, 12], [0.5, 0.5, 0.5]),
    })
    const transitions = assignTransitions(plan, analysis)
    expect(transitions[1]).toBe('dissolve')
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
    const transitions = assignTransitions(plan, analysis)
    expect(transitions).toEqual(['cut'])
  })
})
