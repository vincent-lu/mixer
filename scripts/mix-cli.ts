#!/usr/bin/env tsx

import type { MixStyle } from '../src/shared/types'
import { runMixPipeline } from '../src/main/mixer/pipeline'

const VALID_STYLES: MixStyle[] = ['chill', 'relaxed', 'balanced', 'energetic', 'hyperkinetic']

interface CliArgs {
  bgm: string
  videos: string[]
  output: string
  segmentDuration?: number
  minSegment?: number
  style?: MixStyle
  noTransitions: boolean
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  let bgm = ''
  let output = ''
  let segmentDuration: number | undefined
  let minSegment: number | undefined
  let style: MixStyle | undefined
  let noTransitions = false
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
      case '--no-transitions':
        noTransitions = true
        break
      default:
        console.error(`Unknown flag: ${argv[i]}`)
        process.exit(1)
    }
  }

  if (!bgm || videos.length === 0 || !output) {
    console.error(
      'Usage: pnpm mix --bgm <path> --videos <path1> [path2...] --output <path> [--segment-duration <s> | --min-segment <s>] [--style <style>] [--no-transitions]',
    )
    process.exit(1)
  }

  if (segmentDuration !== undefined && minSegment !== undefined) {
    console.error('Cannot use both --segment-duration and --min-segment. Use one or the other.')
    process.exit(1)
  }

  if (minSegment !== undefined && style !== undefined) {
    console.warn('Warning: --min-segment overrides --style. Style-driven pacing will not be used.')
  }

  return { bgm, videos, output, segmentDuration, minSegment, style, noTransitions }
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
  console.log(`Transitions: ${args.noTransitions ? 'off' : 'on'}`)
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
    enableTransitions: !args.noTransitions,
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
