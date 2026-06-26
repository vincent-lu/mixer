import { access, writeFile, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { probeVideo } from './probe'
import { normalizeVideos, DEFAULT_PRESET } from './normalize'
import { analyzeBgm } from './analyze'
import { buildSegmentPlan } from './segments'
import { buildConcatFileContent, buildFfmpegArgs } from './concat'
import { runFfmpeg } from './encode'
import { buildFilterComplexArgs } from './filter'
import { assignTransitions } from './transitions'
import { assignEffects } from './effects'
import type { PipelineOptions, PipelineResult } from './types'

export async function runMixPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const {
    segmentDuration,
    minSegmentDuration,
    mixStyle,
    transitionDensity = 30,
    transitionEffect = 'cut', // runner.ts overrides to 'circleopen' for legacy DB records
    clipEffect = 'none',
    effectChance = 0,
    onProgress,
    signal,
  } = options

  const bgmPath = resolve(options.bgmPath)
  const sourceVideoPaths = options.sourceVideoPaths.map((p) => resolve(p))
  const outputPath = resolve(options.outputPath)

  await access(bgmPath)
  await Promise.all(sourceVideoPaths.map((p) => access(p)))

  signal?.throwIfAborted()

  const probes = await Promise.all(sourceVideoPaths.map((p) => probeVideo(p)))

  signal?.throwIfAborted()

  const normalizedProbes = await normalizeVideos(probes, DEFAULT_PRESET, onProgress, signal)

  signal?.throwIfAborted()

  const analysis = await analyzeBgm(bgmPath, { segmentDuration, minSegmentDuration, mixStyle })

  onProgress?.('analyzing', 100)

  const plan = buildSegmentPlan(analysis, normalizedProbes)

  signal?.throwIfAborted()

  const transitions = transitionDensity > 0 && transitionEffect !== 'cut'
    ? assignTransitions(plan, analysis, transitionDensity, transitionEffect, mixStyle ?? 'balanced')
    : []
  const effects = assignEffects(plan.segments.length, clipEffect, effectChance)
  const hasTransitions = transitions.some((t) => t.type !== 'cut')
  const hasEffects = effects.length > 0

  if (hasTransitions || hasEffects) {
    // Empty when transitionEffect === 'cut'; padded with cuts for effects-only filter_complex path
    const paddedTransitions = transitions.length > 0
      ? transitions
      : Array.from({ length: plan.segments.length - 1 }, () => ({ type: 'cut' as const, duration: 0 }))
    const { inputArgs, filterScript, outputArgs } = buildFilterComplexArgs(plan, paddedTransitions, bgmPath, outputPath, effects)
    const filterPath = join(tmpdir(), `mixer-filter-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
    try {
      await writeFile(filterPath, filterScript, 'utf-8')
      const args = [...inputArgs, '-filter_complex_script', filterPath, ...outputArgs]
      await runFfmpeg(args, analysis.bgmDuration, onProgress && ((pct) => onProgress('mixing', pct)), signal)
    } finally {
      await unlink(filterPath).catch(() => {})
    }
  } else {
    const concatPath = join(tmpdir(), `mixer-concat-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
    try {
      await writeFile(concatPath, buildConcatFileContent(plan), 'utf-8')
      const args = buildFfmpegArgs(concatPath, bgmPath, outputPath)
      await runFfmpeg(args, analysis.bgmDuration, onProgress && ((pct) => onProgress('mixing', pct)), signal)
    } finally {
      await unlink(concatPath).catch(() => {})
    }
  }

  return {
    outputPath,
    totalDuration: plan.totalDuration,
    segmentCount: plan.segments.length,
  }
}
