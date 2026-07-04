import { describe, expect, it } from 'vitest'
import { needsNormalization, isLocalPath, buildNormalizeArgs } from '../normalize'
import type { NormalizePreset, ProbeResult } from '../types'

const preset: NormalizePreset = { codec: 'h264', width: 1920, height: 1080, fps: 30, pixFmt: 'yuv420p' }

function makeProbe(overrides: Partial<ProbeResult> = {}): ProbeResult {
  return {
    path: '/Users/test/video.mp4',
    duration: 60,
    codec: 'h264',
    width: 1920,
    height: 1080,
    fps: 30,
    pixFmt: 'yuv420p',
    sar: '1:1',
    fastStart: true,
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

  it('returns true for mismatched pixFmt', () => {
    expect(needsNormalization(makeProbe({ pixFmt: 'yuv444p' }), preset)).toBe(true)
  })

  it('returns true for non-square SAR', () => {
    expect(needsNormalization(makeProbe({ sar: '4:3' }), preset)).toBe(true)
  })

  it('returns false for SAR 1:1 (probe coerces 0:1 to 1:1)', () => {
    expect(needsNormalization(makeProbe({ sar: '1:1' }), preset)).toBe(false)
  })

  it('returns true when fastStart is false', () => {
    expect(needsNormalization(makeProbe({ fastStart: false }), preset)).toBe(true)
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

  it('includes scale, pad, and setsar filter for target resolution', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)
    const vfIndex = args.indexOf('-vf')
    expect(vfIndex).toBeGreaterThan(-1)
    const filter = args[vfIndex + 1]!
    expect(filter).toContain('scale=1920:1080')
    expect(filter).toContain('pad=1920:1080')
    expect(filter).toContain('force_original_aspect_ratio=decrease')
    expect(filter).toContain('setsar=1')
  })

  it('includes faststart movflags', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)
    const movflagsIndex = args.indexOf('-movflags')
    expect(movflagsIndex).toBeGreaterThan(-1)
    expect(args[movflagsIndex + 1]).toBe('+faststart')
  })

  it('inserts -ss before -i when trimOffset > 0', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset, 2.5)
    const ssIndex = args.indexOf('-ss')
    const iIndex = args.indexOf('-i')
    expect(ssIndex).toBeGreaterThan(-1)
    expect(args[ssIndex + 1]).toBe('2.5')
    expect(ssIndex).toBeLessThan(iIndex)
  })

  it('omits -ss when trimOffset is 0', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset, 0)
    expect(args).not.toContain('-ss')
  })

  it('places output path last', () => {
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', preset)
    expect(args.at(-1)).toBe('/output.mp4')
  })

  it('uses preset values for different presets', () => {
    const p720: NormalizePreset = { codec: 'h264', width: 1280, height: 720, fps: 25, pixFmt: 'yuv420p' }
    const args = buildNormalizeArgs('/input.mp4', '/output.mp4', p720)
    const vfIndex = args.indexOf('-vf')
    const filter = args[vfIndex + 1]!
    expect(filter).toContain('scale=1280:720')
    expect(filter).toContain('pad=1280:720')
    expect(args).toContain('25')
  })
})
