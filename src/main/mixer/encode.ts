import { spawn } from 'node:child_process'
import type { OnProgress } from './types'

const TIME_RE = /time=(\d{2}):(\d{2}):(\d{2}\.\d+)/
const STDERR_TAIL_LINES = 20

function parseTime(line: string): number | null {
  const match = TIME_RE.exec(line)
  if (!match) return null
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

export function runFfmpeg(
  args: string[],
  totalDuration: number,
  onProgress?: OnProgress,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] })
    const stderrLines: string[] = []
    let stderrPartial = ''

    child.on('error', (err) => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)))

    child.on('close', (code) => {
      if (code === 0) {
        onProgress?.('mixing', 100)
        resolve()
      } else if (signal?.aborted) {
        reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
      } else {
        reject(new Error(`ffmpeg exited with code ${code}:\n${stderrLines.slice(-STDERR_TAIL_LINES).join('\n')}`))
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderrPartial += chunk.toString()
      const lines = stderrPartial.split('\n')
      stderrPartial = lines.pop() ?? ''

      for (const line of lines) {
        if (stderrLines.length >= STDERR_TAIL_LINES) stderrLines.shift()
        stderrLines.push(line)

        if (onProgress && totalDuration > 0) {
          const time = parseTime(line)
          if (time !== null) {
            const percent = Math.min(100, Math.round((time / totalDuration) * 100))
            onProgress('mixing', percent)
          }
        }
      }
    })

    if (signal) {
      const onAbort = (): void => {
        child.kill('SIGTERM')
      }
      signal.addEventListener('abort', onAbort, { once: true })
      child.on('close', () => signal.removeEventListener('abort', onAbort))

      if (signal.aborted) {
        child.kill('SIGTERM')
      }
    }
  })
}
