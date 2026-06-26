#!/usr/bin/env tsx

import type { ClipEffect, MixStyle, TransitionEffect } from '../src/shared/types'
import { runMixPipeline } from '../src/main/mixer/pipeline'

const VALID_STYLES: MixStyle[] = ['chill', 'relaxed', 'balanced', 'energetic', 'hyperkinetic', 'frenetic', 'chaos']
const VALID_TRANSITION_EFFECTS: TransitionEffect[] = ['cut', 'circleopen', 'fadewhite', 'horzopen', 'vertopen', 'acid', 'doublevision', 'solarize', 'strobe', 'strobe_white']
const VALID_CLIP_EFFECTS: ClipEffect[] = ['none', 'shake', 'shake_hard', 'shake_blur', 'zoompulse', 'kenburns', 'drift', 'vignette_pulse', 'hueshift', 'flashpulse', 'negflash', 'chromatic']

interface CliArgs {
  bgm: string
  videos: string[]
  output: string
  segmentDuration?: number
  minSegment?: number
  style?: MixStyle
  lookahead?: number
  transitionDensity: number
  transitionEffect: TransitionEffect
  clipEffect: ClipEffect
  effectChance: number
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  let bgm = ''
  let output = ''
  let segmentDuration: number | undefined
  let minSegment: number | undefined
  let style: MixStyle | undefined
  let lookahead: number | undefined
  let transitionDensity = 30
  let transitionEffect: TransitionEffect = 'cut'
  let clipEffect: ClipEffect = 'none'
  let effectChance = 0
  const videos: string[] = []

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--bgm':
        bgm = argv[++i] ?? ''
        break
      case '--videos': {
        i++
        while (i < argv.length && !argv[i]!.startsWith('--')) {
          videos.push(argv[i]!)
          i++
        }
        i--
        break
      }
      case '--output':
        output = argv[++i] ?? ''
        break
      case '--segment-duration': {
        const val = Number(argv[++i])
        if (isNaN(val) || val <= 0) {
          console.error('--segment-duration must be a positive number')
          process.exit(1)
        }
        segmentDuration = val
        break
      }
      case '--min-segment': {
        const val = Number(argv[++i])
        if (isNaN(val) || val <= 0) {
          console.error('--min-segment must be a positive number')
          process.exit(1)
        }
        minSegment = val
        break
      }
      case '--style': {
        const val = argv[++i] ?? ''
        if (!VALID_STYLES.includes(val as MixStyle)) {
          console.error(`--style must be one of: ${VALID_STYLES.join(', ')}`)
          process.exit(1)
        }
        style = val as MixStyle
        break
      }
      case '--lookahead': {
        const val = Number(argv[++i])
        if (isNaN(val) || val < 0) {
          console.error('--lookahead must be a non-negative number')
          process.exit(1)
        }
        lookahead = val
        break
      }
      case '--no-transitions':
        transitionDensity = 0
        break
      case '--transition-density': {
        const val = Number(argv[++i])
        if (isNaN(val) || val < 0 || val > 100) {
          console.error('--transition-density must be 0-100')
          process.exit(1)
        }
        transitionDensity = val
        break
      }
      case '--transition-effect': {
        const val = argv[++i] ?? ''
        if (!VALID_TRANSITION_EFFECTS.includes(val as TransitionEffect)) {
          console.error(`--transition-effect must be one of: ${VALID_TRANSITION_EFFECTS.join(', ')}`)
          process.exit(1)
        }
        transitionEffect = val as TransitionEffect
        break
      }
      case '--clip-effect': {
        const val = argv[++i] ?? ''
        if (!VALID_CLIP_EFFECTS.includes(val as ClipEffect)) {
          console.error(`--clip-effect must be one of: ${VALID_CLIP_EFFECTS.join(', ')}`)
          process.exit(1)
        }
        clipEffect = val as ClipEffect
        break
      }
      case '--effect-chance': {
        const val = Number(argv[++i])
        if (isNaN(val) || val < 0 || val > 100) {
          console.error('--effect-chance must be 0-100')
          process.exit(1)
        }
        effectChance = val
        break
      }
      default:
        console.error(`Unknown flag: ${argv[i]}`)
        process.exit(1)
    }
  }

  if (!bgm || videos.length === 0 || !output) {
    console.error(
      'Usage: pnpm mix --bgm <path> --videos <path1> [path2...] --output <path> [--segment-duration <s> | --min-segment <s>] [--style <style>] [--lookahead <s>] [--transition-density 0-100] [--transition-effect <name>] [--clip-effect <name>] [--effect-chance 0-100] [--no-transitions]',
    )
    process.exit(1)
  }

  if (segmentDuration !== undefined && minSegment !== undefined) {
    console.error('Cannot use both --segment-duration and --min-segment. Use one or the other.')
    process.exit(1)
  }

  if (minSegment !== undefined && (style !== undefined || lookahead !== undefined)) {
    console.warn('Warning: --min-segment overrides --style and --lookahead. Style-driven pacing will not be used.')
  }

  return { bgm, videos, output, segmentDuration, minSegment, style, lookahead, transitionDensity, transitionEffect, clipEffect, effectChance }
}

async function main(): Promise<void> {
  const args = parseArgs()

  const mode = args.segmentDuration !== undefined ? 'fixed-interval' : 'beat-detection'

  console.log(`BGM:      ${args.bgm}`)
  console.log(`Videos:   ${args.videos.join(', ')}`)
  console.log(`Output:   ${args.output}`)
  console.log(`Mode:     ${mode}`)
  if (args.segmentDuration !== undefined) {
    console.log(`Segment:  ${args.segmentDuration}s (fixed)`)
  } else {
    console.log(`Min gap:  ${args.minSegment ?? 'style-driven'}`)
  }
  console.log(`Style:    ${args.style ?? 'balanced'}`)
  console.log(`Lookahead: ${args.lookahead ?? 'style default'}`)
  console.log(`Transitions: effect ${args.transitionEffect}, density ${args.transitionDensity}%`)
  console.log(`Clip effect: ${args.clipEffect}, chance ${args.effectChance}%`)
  console.log()

  const ac = new AbortController()
  process.on('SIGINT', () => {
    console.log('\nAborting...')
    ac.abort()
  })

  const result = await runMixPipeline({
    bgmPath: args.bgm,
    sourceVideoPaths: args.videos,
    outputPath: args.output,
    segmentDuration: args.segmentDuration,
    minSegmentDuration: args.minSegment,
    mixStyle: args.style,
    lookahead: args.lookahead,
    transitionDensity: args.transitionDensity,
    transitionEffect: args.transitionEffect,
    clipEffect: args.clipEffect,
    effectChance: args.effectChance,
    signal: ac.signal,
    onProgress: (stage, percent) => {
      process.stdout.write(`\r[${stage}] ${String(percent).padStart(3)}%`)
    },
  })

  console.log()
  console.log()
  console.log(`Done. ${result.segmentCount} segments, ${result.totalDuration.toFixed(1)}s`)
  console.log(`Output: ${result.outputPath}`)
}

main().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
