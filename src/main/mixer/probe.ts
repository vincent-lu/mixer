import { open } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { ProbeResult } from './types'

const execFileAsync = promisify(execFile)

const PROBE_ARGS = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams']

interface FfprobeOutput {
  format?: { duration?: string }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    r_frame_rate?: string
    pix_fmt?: string
    sample_aspect_ratio?: string
  }>
}

function parseFps(rFrameRate: string | undefined): number {
  if (!rFrameRate) return 30
  const [num, den] = rFrameRate.split('/')
  if (!num || !den || Number(den) === 0) return 30
  return Math.round(Number(num) / Number(den))
}

async function checkFastStart(filePath: string): Promise<boolean> {
  const ext = filePath.split('.').pop()?.toLowerCase()
  if (!['mp4', 'mov', 'm4v'].includes(ext ?? '')) return true

  let fh
  try {
    fh = await open(filePath, 'r')
    const buf = Buffer.alloc(8)
    let offset = 0
    const MAX_SCAN = 100 * 1024 * 1024

    while (offset < MAX_SCAN) {
      const { bytesRead } = await fh.read(buf, 0, 8, offset)
      if (bytesRead < 8) break

      let size = buf.readUInt32BE(0)
      const type = buf.toString('ascii', 4, 8)

      if (type === 'moov') return true
      if (type === 'mdat') return false

      if (size === 1) {
        const ext64 = Buffer.alloc(8)
        const { bytesRead: r2 } = await fh.read(ext64, 0, 8, offset + 8)
        if (r2 < 8) break
        size = Number(ext64.readBigUInt64BE(0))
      }

      if (size < 8) break
      offset += size
    }

    return true
  } catch {
    return true
  } finally {
    await fh?.close()
  }
}

export async function probeVideo(path: string): Promise<ProbeResult> {
  const { stdout } = await execFileAsync('ffprobe', [...PROBE_ARGS, path])
  const data: FfprobeOutput = JSON.parse(stdout)

  const videoStream = data.streams?.find((s) => s.codec_type === 'video')
  if (!videoStream) throw new Error(`No video stream found in: ${path}`)

  const duration = Number(data.format?.duration)
  if (!duration || !isFinite(duration)) throw new Error(`Could not determine duration of: ${path}`)

  return {
    path,
    duration,
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    codec: videoStream.codec_name ?? 'unknown',
    fps: parseFps(videoStream.r_frame_rate),
    pixFmt: videoStream.pix_fmt ?? 'unknown',
    sar: (videoStream.sample_aspect_ratio === '0:1' ? '1:1' : videoStream.sample_aspect_ratio) ?? '1:1',
    fastStart: await checkFastStart(path),
  }
}

export async function probeFirstKeyframeOffset(path: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-select_streams', 'v:0',
      '-show_entries', 'frame=key_frame,pts_time',
      '-read_intervals', '%+#1',
      '-print_format', 'json',
      path,
    ])
    const data = JSON.parse(stdout) as { frames?: Array<{ key_frame?: number; pts_time?: string }> }
    const first = data.frames?.[0]
    if (!first || first.key_frame === 1) return 0

    const { stdout: kfOut } = await execFileAsync('ffprobe', [
      '-v', 'quiet', '-select_streams', 'v:0',
      '-skip_frame', 'nokey',
      '-show_entries', 'frame=pts_time',
      '-read_intervals', '%+10',
      '-print_format', 'json',
      path,
    ])
    const kfData = JSON.parse(kfOut) as { frames?: Array<{ pts_time?: string }> }
    const firstKf = kfData.frames?.[0]
    return firstKf?.pts_time ? Number(firstKf.pts_time) : 0
  } catch {
    return 0
  }
}

export async function probeAudioDuration(path: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [...PROBE_ARGS, path])
  const data: FfprobeOutput = JSON.parse(stdout)

  if (!data.streams?.some((s) => s.codec_type === 'audio')) {
    throw new Error(`No audio stream found in: ${path}`)
  }

  const duration = Number(data.format?.duration)
  if (!duration || !isFinite(duration)) throw new Error(`Could not determine duration of: ${path}`)

  return duration
}
