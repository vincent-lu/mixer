import { describe, expect, it } from 'vitest'
import { buildSegmentPlan } from '../segments'
import type { AnalysisResult } from '@shared/types'
import type { ProbeResult } from '../types'

const makeProbes = (count: number, duration = 60): ProbeResult[] =>
  Array.from({ length: count }, (_, i) => ({
    path: `/video_${i}.mp4`,
    duration,
    width: 1920,
    height: 1080,
    codec: 'h264',
    fps: 30,
  }))

const makeAnalysis = (segmentDuration: number, totalDuration: number): AnalysisResult => {
  const timings: number[] = [0]
  let t = segmentDuration
  while (t < totalDuration) {
    timings.push(t)
    t += segmentDuration
  }
  timings.push(totalDuration)
  return { bpm: 0, sectionTimings: timings, bgmDuration: totalDuration, sceneCount: timings.length - 1 }
}

describe('buildSegmentPlan', () => {
  it('produces the correct number of segments', () => {
    const plan = buildSegmentPlan(makeAnalysis(4, 120), makeProbes(3, 180))
    expect(plan.segments).toHaveLength(30)
    expect(plan.totalDuration).toBe(120)
  })

  it('distributes segments roughly equally across sources', () => {
    const plan = buildSegmentPlan(makeAnalysis(4, 120), makeProbes(3, 180))

    const counts = [0, 0, 0]
    for (const seg of plan.segments) counts[seg.sourceIndex]!++

    expect(counts[0]).toBe(10)
    expect(counts[1]).toBe(10)
    expect(counts[2]).toBe(10)
  })

  it('avoids consecutive same-source segments at round boundaries', () => {
    const plan = buildSegmentPlan(makeAnalysis(2, 60), makeProbes(3, 120))

    let consecutiveViolations = 0
    for (let i = 1; i < plan.segments.length; i++) {
      if (plan.segments[i]!.sourceIndex === plan.segments[i - 1]!.sourceIndex) {
        consecutiveViolations++
      }
    }
    // Reshuffling is best-effort (5 attempts), so allow rare violations
    expect(consecutiveViolations).toBeLessThan(plan.segments.length * 0.1)
  })

  it('uses proportional advancement when video is shorter than total needed', () => {
    // 10 segments of 4s assigned to a 30s video → stride = 30/10 = 3s
    const plan = buildSegmentPlan(makeAnalysis(4, 120), makeProbes(3, 30))

    for (const seg of plan.segments) {
      expect(seg.inpoint).toBeGreaterThanOrEqual(0)
      expect(seg.outpoint).toBeLessThanOrEqual(30)
    }

    // Segments for each source should advance proportionally, not restart
    const bySource = [0, 1, 2].map((idx) =>
      plan.segments.filter((s) => s.sourceIndex === idx),
    )
    for (const sourceSegs of bySource) {
      for (let i = 1; i < sourceSegs.length; i++) {
        expect(sourceSegs[i]!.inpoint).toBeGreaterThan(sourceSegs[i - 1]!.inpoint)
      }
    }
  })

  it('spreads single short video across full BGM without restart', () => {
    // 1 video of 30s, BGM of 120s, segments of 4s → 30 segments, stride = 30/30 = 1s
    const plan = buildSegmentPlan(makeAnalysis(4, 120), makeProbes(1, 30))

    expect(plan.segments).toHaveLength(30)
    // Each segment should start 1s after the previous
    for (let i = 1; i < plan.segments.length; i++) {
      const gap = plan.segments[i]!.inpoint - plan.segments[i - 1]!.inpoint
      expect(gap).toBeCloseTo(1, 5)
    }
    // No inpoint should be 0 after the first segment (no restart)
    for (let i = 1; i < plan.segments.length; i++) {
      expect(plan.segments[i]!.inpoint).toBeGreaterThan(0)
    }
  })

  it('handles a single source video', () => {
    const plan = buildSegmentPlan(makeAnalysis(4, 20), makeProbes(1, 60))

    expect(plan.segments).toHaveLength(5)
    for (const seg of plan.segments) {
      expect(seg.sourceIndex).toBe(0)
    }
  })

  it('returns empty plan for zero probes', () => {
    const plan = buildSegmentPlan(makeAnalysis(4, 20), [])
    expect(plan.segments).toHaveLength(0)
    expect(plan.totalDuration).toBe(20)
  })

  it('clamps outpoint when segment exceeds source duration', () => {
    // Segment duration (10s) longer than source video (5s)
    const plan = buildSegmentPlan(makeAnalysis(10, 20), makeProbes(1, 5))
    for (const seg of plan.segments) {
      expect(seg.outpoint).toBeLessThanOrEqual(5)
    }
  })

  it('returns empty plan for zero segments', () => {
    const analysis: AnalysisResult = {
      bpm: 0,
      sectionTimings: [0],
      bgmDuration: 0,
      sceneCount: 0,
    }
    const plan = buildSegmentPlan(analysis, makeProbes(3))
    expect(plan.segments).toHaveLength(0)
  })

  it('sets correct source paths on segments', () => {
    const probes = makeProbes(2, 60)
    const plan = buildSegmentPlan(makeAnalysis(4, 8), probes)

    for (const seg of plan.segments) {
      expect(seg.sourcePath).toBe(probes[seg.sourceIndex]!.path)
    }
  })
})
