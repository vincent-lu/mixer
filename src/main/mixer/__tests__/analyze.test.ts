import { describe, expect, it, vi } from 'vitest'
import { analyzeBgm } from '../analyze'

vi.mock('../probe', () => ({
  probeAudioDuration: vi.fn().mockResolvedValue(120),
}))

describe('analyzeBgm', () => {
  it('produces evenly-spaced section timings', async () => {
    const result = await analyzeBgm('/fake/bgm.mp3', 4)

    expect(result.bgmDuration).toBe(120)
    expect(result.sectionTimings[0]).toBe(0)
    expect(result.sectionTimings.at(-1)).toBe(120)
    expect(result.sceneCount).toBe(30)

    for (let i = 1; i < result.sectionTimings.length - 1; i++) {
      expect(result.sectionTimings[i]! - result.sectionTimings[i - 1]!).toBe(4)
    }
  })

  it('handles BGM shorter than one segment', async () => {
    const { probeAudioDuration } = await import('../probe')
    vi.mocked(probeAudioDuration).mockResolvedValueOnce(2)

    const result = await analyzeBgm('/fake/short.mp3', 4)

    expect(result.sectionTimings).toEqual([0, 2])
    expect(result.sceneCount).toBe(1)
  })

  it('handles BGM duration not divisible by segment duration', async () => {
    const { probeAudioDuration } = await import('../probe')
    vi.mocked(probeAudioDuration).mockResolvedValueOnce(10)

    const result = await analyzeBgm('/fake/bgm.mp3', 3)

    expect(result.sectionTimings).toEqual([0, 3, 6, 9, 10])
    expect(result.sceneCount).toBe(4)
  })

  it('sets bpm to 0 for fixed-interval mode', async () => {
    const result = await analyzeBgm('/fake/bgm.mp3', 4)
    expect(result.bpm).toBe(0)
  })
})
