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
  }>
}

function parseFps(rFrameRate: string | undefined): number {
  if (!rFrameRate) return 30
  const [num, den] = rFrameRate.split('/')
  if (!num || !den || Number(den) === 0) return 30
  return Math.round(Number(num) / Number(den))
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
