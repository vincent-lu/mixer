import { describe, expect, it } from 'vitest'
import { needsNormalization, isLocalPath, buildNormalizeArgs } from '../normalize'
import type { NormalizePreset, ProbeResult } from '../types'

const preset: NormalizePreset = { codec: 'h264', width: 1920, height: 1080, fps: 30 }

function makeProbe(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    path: '/Users/test/video.mp4',
    duration: 60,
    codec: 'h264',
    width: 1920,
    height: 1080,
    fps: 30,
    ...overrides,
  }
}

describe('needsNormalization', () => {
  it('returns false when probe matches preset', () => {
    expect(needsNormalization(makeProbe(), preset)).toBe(false)
  })

  it('returns true for mismatched codec', () => {
    expect(needsNormalization(makeProbe({ codec: 'hevc' }), preset)).toBe(true)
  })

  it('returns true for mismatched width', () => {
    expect(needsNormalization(makeProbe({ width: 3840 }), preset)).toBe(true)
  })

  it('returns true for mismatched height', () => {
    expect(needsNormalization(makeProbe({ height: 720 }), preset)).toBe(true)
  })

  it('returns true for mismatched fps', () => {
    expect(needsNormalization(makeProbe({ fps: 60 }), preset)).toBe(true)
  })

  it('returns true for multiple mismatches', () => {
    expect(needsNormalization(makeProbe({ codec: 'vp9', width: 3840, height: 2160, fps: 60 }), preset)).toBe(true)
  })
})

describe('isLocalPath', () => {
  it('returns true for /Users/ paths on darwin', () => {
    expect(isLocalPath('/Users/vincent/Videos/clip.mp4')).toBe(true)
  })

  it('returns false for /Volumes/ paths on darwin', () => {
    expect(isLocalPath('/Volumes/NAS/Videos/clip.mp4')).toBe(false)
  })

  it('returns false for /tmp/ paths on darwin', () => {
    expect(isLocalPath('/tmp/clip.mp4')).toBe(false)
  })
})

describe('buildNormalizeArgs', () => {
  it('includes codec, resolution, fps, and audio copy flags', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)

    expect(args).toContain('-y')
    expect(args).toContain('/input.mp4')
    expect(args).toContain('libx264')
    expect(args).toContain('-crf')
    expect(args).toContain('18')
    expect(args).toContain('-r')
    expect(args).toContain('30')
    expect(args).toContain('-pix_fmt')
    expect(args).toContain('yuv420p')
    expect(args).toContain('-c:a')
    expect(args).toContain('copy')
  })

  it('includes scale and pad filter for target resolution', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)
    const vfIndex = args.indexOf('-vf')
    expect(vfIndex).toBeGreaterThan(-1)
    const filter = args[vfIndex + 1]!
    expect(filter).toContain('scale=1920:1080')
    expect(filter).toContain('pad=1920:1080')
    expect(filter).toContain('force_original_aspect_ratio=decrease')
  })

  it('places output path last', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)
    expect(args.at(-1)).toBe('/output.mp4')
  })

  it('uses preset values for different presets', () => {
    const p720: NormalizePreset = { codec: 'h264', width: 1280, height: 720, fps: 25 }
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', p720)
    const vfIndex = args.indexOf('-vf')
    const filter = args[vfIndex + 1]!
    expect(filter).toContain('scale=1280:720')
    expect(filter).toContain('pad=1280:720')
    expect(args).toContain('25')
  })
})
