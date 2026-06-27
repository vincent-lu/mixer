import { describe, expect, it } from 'vitest'
import { allocateVideos } from '../allocate'

const videos = Array.from({ length: 20 }, (_, i) => `video_${i}.mp4`)

describe('allocateVideos', () => {
  it('returns correct number of jobs with correct size', () => {
    const result = allocateVideos(videos, 3, 5)
    expect(result).toHaveLength(3)
    for (const job of result) {
      expect(job).toHaveLength(5)
    }
  })

  it('all unique when total draws <= available videos', () => {
    const result = allocateVideos(videos, 3, 5)
    const allPicks = result.flat()
    expect(allPicks).toHaveLength(15)
    expect(new Set(allPicks).size).toBe(15)
  })

  it('spreads evenly when overlap is forced', () => {
    const small = ['a.mp4', 'b.mp4', 'c.mp4', 'd.mp4', 'e.mp4', 'f.mp4']
    const result = allocateVideos(small, 4, 3)
    const counts = new Map<string, number>()
    for (const pick of result.flat()) {
      counts.set(pick, (counts.get(pick) ?? 0) + 1)
    }
    // 12 draws from 6 videos → each appears exactly 2 times
    for (const count of counts.values()) {
      expect(count).toBe(2)
    }
  })

  it('handles single job', () => {
    const result = allocateVideos(videos, 1, 5)
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(5)
    expect(new Set(result[0]).size).toBe(5)
  })

  it('handles videosPerJob > available videos', () => {
    const small = ['a.mp4', 'b.mp4']
    const result = allocateVideos(small, 2, 5)
    expect(result).toHaveLength(2)
    for (const job of result) {
      expect(job).toHaveLength(5)
    }
  })

  it('returns empty array for zero inputs', () => {
    expect(allocateVideos([], 3, 5)).toEqual([])
    expect(allocateVideos(videos, 0, 5)).toEqual([])
    expect(allocateVideos(videos, 3, 0)).toEqual([])
  })

  it('only contains videos from the input', () => {
    const result = allocateVideos(videos, 5, 4)
    const videoSet = new Set(videos)
    for (const pick of result.flat()) {
      expect(videoSet.has(pick)).toBe(true)
    }
  })
})
