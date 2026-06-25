import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

let cached: { ffmpeg: string; ffprobe: string } | null = null

export async function validateFfmpeg(): Promise<{ ffmpeg: string; ffprobe: string }> {
  if (cached) return cached

  let ffmpegVersion: string
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-version'])
    const match = stdout.split('\n')[0]?.match(/ffmpeg version (\S+)/)
    ffmpegVersion = match?.[1] ?? 'unknown'
  } catch {
    throw new Error(
      'ffmpeg not found on PATH. Install ffmpeg and ensure it is available in your system PATH.',
    )
  }

  let ffprobeVersion: string
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-version'])
    const match = stdout.split('\n')[0]?.match(/ffprobe version (\S+)/)
    ffprobeVersion = match?.[1] ?? 'unknown'
  } catch {
    throw new Error(
      'ffprobe not found on PATH. Install ffmpeg (which includes ffprobe) and ensure it is available in your system PATH.',
    )
  }

  cached = { ffmpeg: ffmpegVersion, ffprobe: ffprobeVersion }
  return cached
}
