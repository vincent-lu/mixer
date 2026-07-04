import { rename, unlink } from 'node:fs/promises'
import { dirname, extname, join } from 'node:path'
import { runFfmpeg } from './encode'
import { probeFirstKeyframeOffset } from './probe'
import type { NormalizePreset, OnProgress, ProbeResult } from './types'

export const DEFAULT_PRESET: NormalizePreset = {
  codec: 'h264',
  width: 1920,
  height: 1080,
  fps: 30,
  pixFmt: 'yuv420p',
}

export function needsNormalization(probe: ProbeResult, preset: NormalizePreset): boolean {
  return (
    probe.codec !== preset.codec ||
    probe.width !== preset.width ||
    probe.height !== preset.height ||
    probe.fps !== preset.fps ||
    probe.pixFmt !== preset.pixFmt ||
    probe.sar !== '1:1' ||
    !probe.fastStart
  )
}

export function isLocalPath(filePath: string): boolean {
  if (process.platform === 'darwin') {
    return filePath.startsWith('/Users/')
  }
  return /^[A-Za-z]:[\\/]/.test(filePath)
}

export function buildNormalizeArgs(
  inputPath: string,
  outputPath: string,
  preset: NormalizePreset,
  trimOffset = 0,
): string[] {
  if (preset.codec !== 'h264') {
    throw new Error(`Unsupported normalize codec: ${preset.codec}. Only h264 is supported.`)
  }

  return [
    '-y',
    ...(trimOffset > 0 ? ['-ss', String(trimOffset)] : []),
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-vf',
    `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease,pad=${preset.width}:${preset.height}:-1:-1:color=black,setsar=1`,
    '-r',
    String(preset.fps),
    '-pix_fmt',
    preset.pixFmt,
    '-movflags',
    '+faststart',
    '-c:a',
    'copy',
    outputPath,
  ]
}

async function normalizeVideo(
  probe: ProbeResult,
  preset: NormalizePreset,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
  trimToKeyframe?: boolean,
): Promise<ProbeResult> {
  const trimOffset = trimToKeyframe ? await probeFirstKeyframeOffset(probe.path) : 0
  if (!needsNormalization(probe, preset) && trimOffset === 0) return probe

  if (!isLocalPath(probe.path)) {
    throw new Error(
      `Source video is on a network or external drive: ${probe.path}\n` +
        'Copy it to a local drive before mixing.',
    )
  }

  const ext = extname(probe.path)
  const dir = dirname(probe.path)
  const tempPath = join(dir, `.mixer-norm-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)

  try {
    signal?.throwIfAborted()
    const args = buildNormalizeArgs(probe.path, tempPath, preset, trimOffset)
    await runFfmpeg(args, Math.max(0, probe.duration - trimOffset), onProgress, signal)
    await rename(tempPath, probe.path)
  } catch (err) {
    await unlink(tempPath).catch(() => {})
    throw err
  }

  return { ...probe, codec: preset.codec, width: preset.width, height: preset.height, fps: preset.fps, pixFmt: preset.pixFmt, sar: '1:1', fastStart: true, duration: Math.max(0, probe.duration - trimOffset) }
}

export async function normalizeVideos(
  probes: ProbeResult[],
  preset: NormalizePreset,
  onProgress?: OnProgress,
  signal?: AbortSignal,
  trimToKeyframe?: boolean,
): Promise<ProbeResult[]> {
  const toProcess = probes.filter((p) => needsNormalization(p, preset) || trimToKeyframe)

  if (toProcess.length === 0) return probes

  const totalDuration = toProcess.reduce((sum, p) => sum + p.duration, 0)
  const progressMap = new Map<string, number>()

  const results = await Promise.all(
    probes.map(async (probe) => {
      if (!needsNormalization(probe, preset) && !trimToKeyframe) return probe

      return normalizeVideo(
        probe,
        preset,
        (percent) => {
          progressMap.set(probe.path, (percent / 100) * probe.duration)
          let elapsed = 0
          for (const d of progressMap.values()) elapsed += d
          onProgress?.('normalizing', Math.min(100, Math.round((elapsed / totalDuration) * 100)))
        },
        signal,
        trimToKeyframe,
      )
    }),
  )

  return results
}
