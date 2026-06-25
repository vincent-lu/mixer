#!/usr/bin/env tsx

import { runMixPipeline } from '../src/main/mixer/pipeline'

interface CliArgs {
  bgm: string
  videos: string[]
  output: string
  segmentDuration: number
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2)
  let bgm = ''
  let output = ''
  let segmentDuration = 4
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
      case '--segment-duration':
        segmentDuration = Number(argv[++i])
        break
      default:
        console.error(`Unknown flag: ${argv[i]}`)
        process.exit(1)
    }
  }

  if (!bgm || videos.length === 0 || !output) {
    console.error(
      'Usage: pnpm mix --bgm <path> --videos <path1> [path2...] --output <path> [--segment-duration <seconds>]',
    )
    process.exit(1)
  }

  if (isNaN(segmentDuration) || segmentDuration <= 0) {
    console.error('--segment-duration must be a positive number')
    process.exit(1)
  }

  return { bgm, videos, output, segmentDuration }
}

async function main(): Promise<void> {
  const args = parseArgs()

  console.log(`BGM:      ${args.bgm}`)
  console.log(`Videos:   ${args.videos.join(', ')}`)
  console.log(`Output:   ${args.output}`)
  console.log(`Segment:  ${args.segmentDuration}s`)
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
