import { access, writeFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { probeVideo } from './probe'
import { normalizeVideos, DEFAULT_PRESET } from './normalize'
import { analyzeBgm } from './analyze'
import { buildSegmentPlan } from './segments'
import { buildConcatFileContent, buildFfmpegArgs } from './concat'
import { runFfmpeg } from './encode'
import type { PipelineOptions, PipelineResult } from './types'

export async function runMixPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    segmentDuration,
    minSegmentDuration,
    onProgress,
    signal,
  } = options

  // Resolve to absolute paths (concat demuxer resolves relative to its own file location)
  const bgmPath = resolve(options.bgmPath)
  const sourceVideoPaths = options.sourceVideoPaths.map((p) => resolve(p))
  const outputPath = resolve(options.outputPath)

  // Validate inputs exist
  await access(bgmPath)
  await Promise.all(sourceVideoPaths.map((p) => access(p)))

  signal?.throwIfAborted()

  // Probe source videos
  const probes = await Promise.all(sourceVideoPaths.map((p) => probeVideo(p)))

  signal?.throwIfAborted()

  // Normalize source videos to common format (skips if all already match)
  const normalizedProbes = await normalizeVideos(probes, DEFAULT_PRESET, onProgress, signal)

  signal?.throwIfAborted()

  // Analyze BGM for cut points (also probes BGM duration internally)
  const analysis = await analyzeBgm(bgmPath, { segmentDuration, minSegmentDuration })

  onProgress?.('analyzing', 100)

  // Plan segments
  const plan = buildSegmentPlan(analysis, normalizedProbes)

  signal?.throwIfAborted()

  // Write concat file to temp location
  const concatPath = join(tmpdir(), `mixer-concat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  try {
    await writeFile(concatPath, buildConcatFileContent(plan), 'utf-8')

    // Run ffmpeg
    const args = buildFfmpegArgs(concatPath, bgmPath, outputPath)
    await runFfmpeg(args, analysis.bgmDuration, onProgress && ((pct) => onProgress('mixing', pct)), signal)
  } finally {
    await unlink(concatPath).catch(() => {})
  }

  return {
    outputPath,
    totalDuration: plan.totalDuration,
    segmentCount: plan.segments.length,
  }
}
