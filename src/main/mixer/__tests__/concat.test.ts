import { describe, expect, it } from 'vitest'
import { buildConcatFileContent, buildFfmpegArgs } from '../concat'
import type { SegmentPlan } from '../types'

describe('buildConcatFileContent', () => {
  it('produces valid concat demuxer syntax', () => {
    const plan: SegmentPlan = {
      totalDuration: 12,
      segments: [
        { sourceIndex: 0, sourcePath: '/videos/blue.mp4', inpoint: 0, outpoint: 4 },
        { sourceIndex: 1, sourcePath: '/videos/red.mp4', inpoint: 0, outpoint: 4 },
        { sourceIndex: 2, sourcePath: '/videos/yellow.mp4', inpoint: 0, outpoint: 4 },
      ],
    }
    const content = buildConcatFileContent(plan)

    expect(content).toContain('ffconcat version 1.0')
    expect(content).toContain("file '/videos/blue.mp4'")
    expect(content).toContain('inpoint 0')
    expect(content).toContain('outpoint 4')
    expect(content).toContain("file '/videos/red.mp4'")
    expect(content).toContain("file '/videos/yellow.mp4'")
  })

  it('escapes single quotes in paths', () => {
    const plan: SegmentPlan = {
      totalDuration: 4,
      segments: [
        { sourceIndex: 0, sourcePath: "/videos/it's a video.mp4", inpoint: 0, outpoint: 4 },
      ],
    }
    const content = buildConcatFileContent(plan)

    expect(content).toContain("file '/videos/it'\\''s a video.mp4'")
  })
})

describe('buildFfmpegArgs', () => {
  it('includes all required flags', () => {
    const args = buildFfmpegArgs('/tmp/concat.txt', '/bgm.mp3', '/out.mp4')

    expect(args).toContain('-y')
    expect(args).toContain('-f')
    expect(args).toContain('concat')
    expect(args).toContain('-safe')
    expect(args).toContain('0')
    expect(args).toContain('/tmp/concat.txt')
    expect(args).toContain('/bgm.mp3')
    expect(args).toContain('-shortest')
    expect(args).toContain('/out.mp4')
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
  })

  it('places output path last', () => {
    const args = buildFfmpegArgs('/tmp/c.txt', '/b.mp3', '/output.mp4')
    expect(args.at(-1)).toBe('/output.mp4')
  })
})
