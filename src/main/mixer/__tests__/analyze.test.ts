import { describe, expect, it, vi, beforeEach } from 'vitest'
import { analyzeBgm, selectBeats } from '../analyze'

vi.mock('../probe', () => ({
  probeAudioDuration: vi.fn().mockResolvedValue(120),
}))

vi.mock('../audio', () => ({
  extractPcm: vi.fn().mockResolvedValue(new Float32Array(0)),
  detectBeats: vi.fn().mockReturnValue({ ticks: [], confidence: 0 }),
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
