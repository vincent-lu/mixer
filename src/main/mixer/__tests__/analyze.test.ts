import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { BeatInfo } from '@shared/types'
import { analyzeBgm, detectSections, scoreBeats, selectBeats, selectScoredBeats } from '../analyze'

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
