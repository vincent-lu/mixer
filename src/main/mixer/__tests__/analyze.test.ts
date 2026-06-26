import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { BeatInfo, Section } from '@shared/types'
import {
  analyzeBgm,
  detectSections,
  resolveMinGap,
  scoreBeats,
  selectBeats,
  selectScoredBeats,
  selectScoredBeatsBySection,
} from '../analyze'

vi.mock('../probe', () => ({
  probeAudioDuration: vi.fn().mockResolvedValue(120),
}))

vi.mock('../audio', () => ({
  extractPcm: vi.fn().mockResolvedValue(new Float32Array(0)),
  detectBeats: vi.fn().mockReturnValue({ ticks: [], confidence: 0 }),
  detectOnsets: vi.fn().mockReturnValue([]),
  computePerBeatEnergy: vi.fn().mockReturnValue([]),
}))

function realisticTicks(count: number, interval: number, offset = 0.487619): number[] {
  return Array.from({ length: count }, (_, i) => offset + i * interval)
}

describe('selectBeats', () => {
  it('filters ticks by minimum duration with realistic intervals', () => {
    const ticks = realisticTicks(240, 0.499229)
    const result = selectBeats(ticks, 4, 120)

    expect(result[0]).toBe(0)
    expect(result.at(-1)).toBe(120)

    for (let i = 1; i < result.length; i++) {
      expect(result[i]! - result[i - 1]!).toBeGreaterThanOrEqual(3.98)
    }
  })

  it('accepts every beat when minDuration matches beat interval', () => {
    const ticks = realisticTicks(240, 0.499229)
    const result = selectBeats(ticks, 0.5, 120)

    expect(result.length).toBe(ticks.length + 1)
  })

  it('returns [0, bgmDuration] for empty ticks', () => {
    expect(selectBeats([], 4, 120)).toEqual([0, 120])
  })

  it('returns [0, bgmDuration] when BGM is shorter than minDuration', () => {
    const ticks = [0.487, 0.987, 1.486]
    expect(selectBeats(ticks, 4, 2)).toEqual([0, 2])
  })

  it('merges last segment when too close to bgmDuration', () => {
    const ticks = [3.993, 7.986, 11.979, 13.977]
    const result = selectBeats(ticks, 4, 15)

    expect(result.at(-1)).toBe(15)
    expect(result.at(-2)).not.toBe(13.977)
    expect(result.filter((t) => t === 15)).toHaveLength(1)
  })

  it('returns [0, bgmDuration] when all ticks are within minDuration', () => {
    const ticks = [0.487, 0.987, 1.486, 1.985, 2.484, 2.984]
    expect(selectBeats(ticks, 10, 120)).toEqual([0, 120])
  })

  it('skips non-positive ticks', () => {
    const ticks = [-1, 0, 0, 3.993, 7.986]
    const result = selectBeats(ticks, 4, 20)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(3.993)
  })

  it('skips ticks at or beyond bgmDuration', () => {
    const ticks = [3.993, 7.986, 120, 130]
    const result = selectBeats(ticks, 4, 120)
    expect(result).toEqual([0, 3.993, 7.986, 120])
  })
})

describe('detectSections', () => {
  it('detects sections in quiet-then-loud PCM', () => {
    const sr = 44100
    const pcm = new Float32Array(sr * 4)
    for (let i = 0; i < sr * 2; i++) pcm[i] = 0.1
    for (let i = sr * 2; i < pcm.length; i++) pcm[i] = 0.9

    const sections = detectSections(pcm, 4.0)

    expect(sections.length).toBe(2)
    expect(sections[0]!.energy).toBe('low')
    expect(sections[1]!.energy).toBe('high')
    expect(sections[0]!.start).toBe(0)
    expect(sections[1]!.end).toBe(4.0)
    expect(sections[0]!.end).toBeGreaterThanOrEqual(1.0)
    expect(sections[0]!.end).toBeLessThanOrEqual(2.5)
  })

  it('returns single medium section for uniform energy', () => {
    const sr = 44100
    const pcm = new Float32Array(sr * 4)
    for (let i = 0; i < pcm.length; i++) pcm[i] = 0.5

    const sections = detectSections(pcm, 4.0)

    expect(sections.length).toBe(1)
    expect(sections[0]).toEqual({ start: 0, end: 4.0, energy: 'medium' })
  })

  it('returns single medium section when RMS range is below epsilon', () => {
    const sr = 44100
    const pcm = new Float32Array(sr * 4)
    for (let i = 0; i < pcm.length; i++) pcm[i] = 0.5 + (i % 2 === 0 ? 0.001 : -0.001)

    const sections = detectSections(pcm, 4.0)

    expect(sections.length).toBe(1)
    expect(sections[0]).toEqual({ start: 0, end: 4.0, energy: 'medium' })
  })

  it('merges short sections into neighbors', () => {
    const sr = 44100
    const pcm = new Float32Array(sr * 9)
    for (let i = 0; i < sr * 4; i++) pcm[i] = 0.1
    for (let i = sr * 4; i < sr * 5; i++) pcm[i] = 0.5
    for (let i = sr * 5; i < pcm.length; i++) pcm[i] = 0.9

    const sections = detectSections(pcm, 9.0)

    expect(sections.length).toBe(2)
    expect(sections[0]!.energy).toBe('low')
    expect(sections[1]!.energy).toBe('high')
  })

  it('merges short first section forward', () => {
    const sr = 44100
    const pcm = new Float32Array(Math.round(sr * 5.5))
    for (let i = 0; i < Math.round(sr * 0.5); i++) pcm[i] = 0.9
    for (let i = Math.round(sr * 0.5); i < pcm.length; i++) pcm[i] = 0.1

    const sections = detectSections(pcm, 5.5)

    for (const s of sections) {
      expect(s.end - s.start).toBeGreaterThanOrEqual(1.5)
    }
    expect(sections[0]!.start).toBe(0)
  })

  it('returns single medium section for empty PCM', () => {
    const sections = detectSections(new Float32Array(0), 10.0)
    expect(sections).toEqual([{ start: 0, end: 10.0, energy: 'medium' }])
  })
})

describe('scoreBeats', () => {
  it('computes composite score from onset proximity and energy', () => {
    const ticks = [1.0, 2.0, 3.0]
    const onsets = [1.0, 3.1]
    const beatEnergy = [0.5, 0.2, 0.8]

    const beats = scoreBeats(ticks, onsets, beatEnergy)

    expect(beats.length).toBe(3)

    expect(beats[0]!.time).toBe(1.0)
    expect(beats[0]!.onsetDistance).toBeCloseTo(0, 5)
    expect(beats[0]!.score).toBeCloseTo(0.619, 2)

    expect(beats[1]!.score).toBeCloseTo(0.181, 2)

    expect(beats[2]!.onsetDistance).toBeCloseTo(0.1, 5)
    expect(beats[2]!.score).toBeCloseTo(0.738, 2)
    expect(beats[2]!.score).toBeGreaterThan(beats[0]!.score)
  })

  it('scores zero when all energy is zero but computes real onset distance', () => {
    const beats = scoreBeats([1.0], [1.0], [0])

    expect(beats[0]!.score).toBe(0)
    expect(beats[0]!.energy).toBe(0)
    expect(beats[0]!.onsetDistance).toBeCloseTo(0, 5)
  })

  it('handles empty onsets with infinite distance', () => {
    const beats = scoreBeats([1.0], [], [0.5])

    expect(beats[0]!.onsetDistance).toBe(Infinity)
    expect(beats[0]!.score).toBeCloseTo(0.35, 5)
  })
})

describe('selectScoredBeats', () => {
  it('prefers high-scored beat over earlier low-scored beat in window', () => {
    const beats: BeatInfo[] = [
      { time: 4.0, score: 0.2, energy: 0.1, onsetDistance: 1.0 },
      { time: 4.5, score: 0.9, energy: 0.8, onsetDistance: 0.01 },
      { time: 5.0, score: 0.3, energy: 0.2, onsetDistance: 0.5 },
    ]

    const result = selectScoredBeats(beats, 4.0, 20)

    expect(result[0]).toBe(0)
    expect(result[1]).toBe(4.5)
  })

  it('returns [0, bgmDuration] for empty beats', () => {
    expect(selectScoredBeats([], 4.0, 120)).toEqual([0, 120])
  })

  it('enforces minimum gap between selections', () => {
    const beats: BeatInfo[] = [
      { time: 2.0, score: 0.9, energy: 0.8, onsetDistance: 0 },
      { time: 4.0, score: 0.5, energy: 0.4, onsetDistance: 0.1 },
      { time: 8.0, score: 0.7, energy: 0.6, onsetDistance: 0.05 },
    ]

    const result = selectScoredBeats(beats, 4.0, 20)

    expect(result).toEqual([0, 4.0, 8.0, 20])
  })

  it('merges last segment when too close to bgmDuration', () => {
    const beats: BeatInfo[] = [
      { time: 4.0, score: 0.5, energy: 0.5, onsetDistance: 0.1 },
      { time: 8.0, score: 0.5, energy: 0.5, onsetDistance: 0.1 },
      { time: 9.5, score: 0.8, energy: 0.8, onsetDistance: 0 },
    ]

    const result = selectScoredBeats(beats, 4.0, 10)

    expect(result.at(-1)).toBe(10)
    expect(result.filter((t) => t === 10)).toHaveLength(1)
  })
})

describe('resolveMinGap', () => {
  it('returns correct values for each style/energy combination', () => {
    expect(resolveMinGap('chill', 'low')).toBe(12.0)
    expect(resolveMinGap('chill', 'medium')).toBe(8.0)
    expect(resolveMinGap('chill', 'high')).toBe(5.0)

    expect(resolveMinGap('balanced', 'low')).toBe(5.0)
    expect(resolveMinGap('balanced', 'medium')).toBe(3.0)
    expect(resolveMinGap('balanced', 'high')).toBe(1.5)

    expect(resolveMinGap('hyperkinetic', 'low')).toBe(1.5)
    expect(resolveMinGap('hyperkinetic', 'medium')).toBe(0.75)
    expect(resolveMinGap('hyperkinetic', 'high')).toBe(0.35)

    expect(resolveMinGap('frenetic', 'low')).toBe(0.75)
    expect(resolveMinGap('frenetic', 'medium')).toBe(0.35)
    expect(resolveMinGap('frenetic', 'high')).toBe(0.2)

    expect(resolveMinGap('chaos', 'low')).toBe(0.35)
    expect(resolveMinGap('chaos', 'medium')).toBe(0.2)
    expect(resolveMinGap('chaos', 'high')).toBe(0.12)
  })

  it('chill never produces sub-second gaps', () => {
    for (const energy of ['low', 'medium', 'high'] as const) {
      expect(resolveMinGap('chill', energy)).toBeGreaterThanOrEqual(1.0)
    }
  })

  it('hyperkinetic never produces 10s+ gaps', () => {
    for (const energy of ['low', 'medium', 'high'] as const) {
      expect(resolveMinGap('hyperkinetic', energy)).toBeLessThan(10.0)
    }
  })

  it('higher energy produces smaller gaps within the same style', () => {
    for (const style of ['chill', 'relaxed', 'balanced', 'energetic', 'hyperkinetic', 'frenetic', 'chaos'] as const) {
      expect(resolveMinGap(style, 'low')).toBeGreaterThan(resolveMinGap(style, 'medium'))
      expect(resolveMinGap(style, 'medium')).toBeGreaterThan(resolveMinGap(style, 'high'))
    }
  })

  it('more energetic style produces smaller gaps at the same energy', () => {
    for (const energy of ['low', 'medium', 'high'] as const) {
      expect(resolveMinGap('chill', energy)).toBeGreaterThan(resolveMinGap('relaxed', energy))
      expect(resolveMinGap('relaxed', energy)).toBeGreaterThan(resolveMinGap('balanced', energy))
      expect(resolveMinGap('balanced', energy)).toBeGreaterThan(resolveMinGap('energetic', energy))
      expect(resolveMinGap('energetic', energy)).toBeGreaterThan(resolveMinGap('hyperkinetic', energy))
      expect(resolveMinGap('hyperkinetic', energy)).toBeGreaterThan(resolveMinGap('frenetic', energy))
      expect(resolveMinGap('frenetic', energy)).toBeGreaterThan(resolveMinGap('chaos', energy))
    }
  })
})

describe('selectScoredBeatsBySection', () => {
  const uniformSections: Section[] = [{ start: 0, end: 60, energy: 'medium' }]

  it('uses section energy to determine gap', () => {
    const beats: BeatInfo[] = Array.from({ length: 120 }, (_, i) => ({
      time: 0.5 * (i + 1),
      score: 0.5,
      energy: 0.5,
      onsetDistance: 0.1,
    }))

    const lowSections: Section[] = [{ start: 0, end: 60, energy: 'low' }]
    const highSections: Section[] = [{ start: 0, end: 60, energy: 'high' }]

    const lowResult = selectScoredBeatsBySection(beats, lowSections, 'balanced', 60)
    const highResult = selectScoredBeatsBySection(beats, highSections, 'balanced', 60)

    expect(lowResult.length).toBeLessThan(highResult.length)
  })

  it('varies density across sections within one song', () => {
    const beats: BeatInfo[] = Array.from({ length: 200 }, (_, i) => ({
      time: 0.5 * (i + 1),
      score: 0.5,
      energy: 0.5,
      onsetDistance: 0.1,
    }))

    const sections: Section[] = [
      { start: 0, end: 30, energy: 'low' },
      { start: 30, end: 70, energy: 'high' },
      { start: 70, end: 100, energy: 'low' },
    ]

    const result = selectScoredBeatsBySection(beats, sections, 'balanced', 100)

    const lowCuts = result.filter((t) => t > 0 && t < 30).length
    const highCuts = result.filter((t) => t >= 30 && t < 70).length
    const scaledLow = lowCuts / 30
    const scaledHigh = highCuts / 40

    expect(scaledHigh).toBeGreaterThan(scaledLow)
  })

  it('style controls overall density', () => {
    const beats: BeatInfo[] = Array.from({ length: 200 }, (_, i) => ({
      time: 0.5 * (i + 1),
      score: 0.5,
      energy: 0.5,
      onsetDistance: 0.1,
    }))

    const chillResult = selectScoredBeatsBySection(beats, uniformSections, 'chill', 60)
    const hyperResult = selectScoredBeatsBySection(beats, uniformSections, 'hyperkinetic', 60)

    expect(chillResult.length).toBeLessThan(hyperResult.length)
  })

  it('chaos produces more cuts than hyperkinetic', () => {
    const beats: BeatInfo[] = Array.from({ length: 200 }, (_, i) => ({
      time: 0.5 * (i + 1),
      score: 0.5,
      energy: 0.5,
      onsetDistance: 0.1,
    }))

    const hyperResult = selectScoredBeatsBySection(beats, uniformSections, 'hyperkinetic', 60)
    const chaosResult = selectScoredBeatsBySection(beats, uniformSections, 'chaos', 60)

    expect(chaosResult.length).toBeGreaterThan(hyperResult.length)
  })

  it('lookahead 0 takes first eligible beat (greedy)', () => {
    const sections: Section[] = [{ start: 0, end: 20, energy: 'high' }]
    const beats: BeatInfo[] = [
      { time: 1.5, score: 0.3, energy: 0.2, onsetDistance: 0.5 },
      { time: 1.8, score: 0.9, energy: 0.8, onsetDistance: 0.01 },
    ]

    const result = selectScoredBeatsBySection(beats, sections, 'balanced', 20, 0)

    expect(result[1]).toBe(1.5)
  })

  it('explicit lookahead overrides style default', () => {
    const sections: Section[] = [{ start: 0, end: 20, energy: 'high' }]
    // hyperkinetic/high: minGap 0.35, default lookahead 0.2, ratio floor 0.14
    // default window: 0.35 + max(0.2, 0.14) = 0.55 → beat at 0.7 outside → picks 0.35
    // explicit 0.5: 0.35 + max(0.5, 0.14) = 0.85 → beat at 0.7 inside → picks 0.7
    const beats: BeatInfo[] = [
      { time: 0.35, score: 0.3, energy: 0.2, onsetDistance: 0.5 },
      { time: 0.7, score: 0.9, energy: 0.8, onsetDistance: 0.01 },
    ]

    const withDefault = selectScoredBeatsBySection(beats, sections, 'hyperkinetic', 20)
    const withWider = selectScoredBeatsBySection(beats, sections, 'hyperkinetic', 20, 0.5)

    expect(withDefault[1]).toBe(0.35)
    expect(withWider[1]).toBe(0.7)
  })

  it('returns [0, bgmDuration] for empty beats', () => {
    expect(selectScoredBeatsBySection([], uniformSections, 'balanced', 60)).toEqual([0, 60])
  })

  it('prefers higher-scored beat in lookahead window', () => {
    const sections: Section[] = [{ start: 0, end: 20, energy: 'high' }]
    const beats: BeatInfo[] = [
      { time: 1.5, score: 0.3, energy: 0.2, onsetDistance: 0.5 },
      { time: 1.8, score: 0.9, energy: 0.8, onsetDistance: 0.01 },
    ]

    const result = selectScoredBeatsBySection(beats, sections, 'balanced', 20)

    expect(result[1]).toBe(1.8)
  })

  it('merges last segment when too close to bgmDuration', () => {
    const sections: Section[] = [{ start: 0, end: 10, energy: 'high' }]
    const beats: BeatInfo[] = [
      { time: 1.5, score: 0.5, energy: 0.5, onsetDistance: 0.1 },
      { time: 3.0, score: 0.5, energy: 0.5, onsetDistance: 0.1 },
      { time: 9.8, score: 0.8, energy: 0.8, onsetDistance: 0 },
    ]

    const result = selectScoredBeatsBySection(beats, sections, 'balanced', 10)

    expect(result.at(-1)).toBe(10)
    expect(result.filter((t) => t === 10)).toHaveLength(1)
  })

  it('skips ineligible beats in lookahead that cross into low-energy section', () => {
    const sections: Section[] = [
      { start: 0, end: 1.7, energy: 'high' },
      { start: 1.7, end: 20, energy: 'low' },
    ]
    const beats: BeatInfo[] = [
      { time: 1.5, score: 0.3, energy: 0.5, onsetDistance: 0.1 },
      { time: 1.8, score: 0.9, energy: 0.8, onsetDistance: 0 },
    ]
    // Beat at 1.5: HIGH section, minGap 1.5s, gap from 0 = 1.5 >= 1.48 → eligible
    // Beat at 1.8: LOW section, minGap 5.0s, gap from 0 = 1.8 < 4.98 → ineligible
    // Despite higher score, 1.8 must be skipped — must pick 1.5
    const result = selectScoredBeatsBySection(beats, sections, 'balanced', 20)
    expect(result[1]).toBe(1.5)
  })
})

describe('analyzeBgm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses fixed-interval when segmentDuration is set', async () => {
    const result = await analyzeBgm('/fake/bgm.mp3', { segmentDuration: 4 })

    expect(result.bpm).toBe(0)
    expect(result.bgmDuration).toBe(120)
    expect(result.sectionTimings[0]).toBe(0)
    expect(result.sectionTimings.at(-1)).toBe(120)
    expect(result.sceneCount).toBe(30)

    for (let i = 1; i < result.sectionTimings.length - 1; i++) {
      expect(result.sectionTimings[i]! - result.sectionTimings[i - 1]!).toBe(4)
    }
  })

  it('uses beat detection by default', async () => {
    const { detectBeats } = await import('../audio')
    const ticks = realisticTicks(240, 0.499229)
    vi.mocked(detectBeats).mockReturnValue({ ticks, confidence: 3.28 })

    const result = await analyzeBgm('/fake/bgm.mp3')

    expect(result.bpm).toBeCloseTo(120.2, 0)
    expect(result.sectionTimings[0]).toBe(0)
    expect(result.sectionTimings.at(-1)).toBe(120)

    for (let i = 1; i < result.sectionTimings.length; i++) {
      expect(result.sectionTimings[i]! - result.sectionTimings[i - 1]!).toBeGreaterThanOrEqual(0.48)
    }
  })

  it('respects minSegmentDuration in beat detection mode', async () => {
    const { detectBeats } = await import('../audio')
    const ticks = realisticTicks(240, 0.499229)
    vi.mocked(detectBeats).mockReturnValue({ ticks, confidence: 3.28 })

    const result = await analyzeBgm('/fake/bgm.mp3', { minSegmentDuration: 8 })

    for (let i = 1; i < result.sectionTimings.length; i++) {
      expect(result.sectionTimings[i]! - result.sectionTimings[i - 1]!).toBeGreaterThanOrEqual(7.98)
    }
  })

  it('minSegmentDuration overrides mixStyle', async () => {
    const { detectBeats } = await import('../audio')
    const ticks = realisticTicks(240, 0.499229)
    vi.mocked(detectBeats).mockReturnValue({ ticks, confidence: 3.28 })

    const withOverride = await analyzeBgm('/fake/bgm.mp3', {
      minSegmentDuration: 0.5,
      mixStyle: 'chill',
    })
    const withStyleOnly = await analyzeBgm('/fake/bgm.mp3', { mixStyle: 'chill' })

    expect(withOverride.sceneCount).toBeGreaterThan(withStyleOnly.sceneCount)
  })

  it('uses style-driven pacing when no minSegmentDuration is set', async () => {
    const { detectBeats } = await import('../audio')
    const ticks = realisticTicks(240, 0.499229)
    vi.mocked(detectBeats).mockReturnValue({ ticks, confidence: 3.28 })

    const chill = await analyzeBgm('/fake/bgm.mp3', { mixStyle: 'chill' })
    const hyper = await analyzeBgm('/fake/bgm.mp3', { mixStyle: 'hyperkinetic' })

    expect(chill.sceneCount).toBeLessThan(hyper.sceneCount)
  })

  it('falls back to fixed-interval on beat detection failure', async () => {
    const { extractPcm } = await import('../audio')
    vi.mocked(extractPcm).mockRejectedValue(new Error('ffmpeg not found'))

    const result = await analyzeBgm('/fake/bgm.mp3')

    expect(result.bpm).toBe(0)
    expect(result.sectionTimings[0]).toBe(0)
    expect(result.sectionTimings.at(-1)).toBe(120)
    expect(result.sceneCount).toBe(240)
  })

  it('handles BGM shorter than one segment', async () => {
    const { probeAudioDuration } = await import('../probe')
    vi.mocked(probeAudioDuration).mockResolvedValueOnce(2)

    const result = await analyzeBgm('/fake/short.mp3', { segmentDuration: 4 })

    expect(result.sectionTimings).toEqual([0, 2])
    expect(result.sceneCount).toBe(1)
  })

  it('handles BGM duration not divisible by segment duration', async () => {
    const { probeAudioDuration } = await import('../probe')
    vi.mocked(probeAudioDuration).mockResolvedValueOnce(10)

    const result = await analyzeBgm('/fake/bgm.mp3', { segmentDuration: 3 })

    expect(result.sectionTimings).toEqual([0, 3, 6, 9, 10])
    expect(result.sceneCount).toBe(4)
  })
})
