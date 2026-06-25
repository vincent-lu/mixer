import type { SegmentPlan } from './types'

function escapePath(p: string): string {
  return p.replace(/'/g, "'\\''")
}

export function buildConcatFileContent(plan: SegmentPlan): string {
  const lines = ['ffconcat version 1.0', '']
  for (const seg of plan.segments) {
    lines.push(`file '${escapePath(seg.sourcePath)}'`)

    lines.push(`inpoint ${seg.inpoint}`)
    lines.push(`outpoint ${seg.outpoint}`)
    lines.push('')
  }
  return lines.join('\n')
}

export function buildFfmpegArgs(
  concatFilePath: string,
  bgmPath: string,
  outputPath: string,
): string[] {
  return [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFilePath,
    '-i', bgmPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-shortest',
    '-movflags', '+faststart',
    outputPath,
  ]
}
