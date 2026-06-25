#!/usr/bin/env node
// Generates solid-color test videos and click-track BGMs. Requires system ffmpeg.

import { execSync } from 'node:child_process'
import { mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '..', 'test-assets')

const VIDEOS = [
  { name: 'blue_3min.mp4', color: 'blue', duration: 180 },
  { name: 'red_4min.mp4', color: 'red', duration: 240 },
  { name: 'yellow_5min.mp4', color: 'yellow', duration: 300 }
]

const BGMS = [
  { name: 'click_120bpm_2min.mp3', bpm: 120, duration: 120, freq: 150 },
  { name: 'click_140bpm_3min.mp3', bpm: 140, duration: 180, freq: 200 },
  { name: 'click_100bpm_4min.mp3', bpm: 100, duration: 240, freq: 100 }
]

mkdirSync(OUTPUT_DIR, { recursive: true })

console.log('Generating test videos...')
for (const v of VIDEOS) {
  const out = join(OUTPUT_DIR, v.name)
  if (existsSync(out)) {
    console.log(`  skip ${v.name} (exists)`)
    continue
  }
  console.log(`  ${v.name}...`)
  execSync(
    `ffmpeg -f lavfi -i "color=c=${v.color}:size=1920x1080:rate=30" ` +
      `-c:v libx264 -preset ultrafast -pix_fmt yuv420p -t ${v.duration} "${out}"`,
    { stdio: 'inherit' }
  )
}

console.log('\nGenerating test BGMs...')
for (const b of BGMS) {
  const out = join(OUTPUT_DIR, b.name)
  if (existsSync(out)) {
    console.log(`  skip ${b.name} (exists)`)
    continue
  }
  console.log(`  ${b.name}...`)
  const bps = b.bpm / 60
  // Exponentially decaying sine pulse at each beat.
  // Uses (x - floor(x)) instead of mod(x, 1) to avoid comma escaping in lavfi.
  const expr = `0.7*sin(2*PI*${b.freq}*t)*exp(-30*(t*${bps}-floor(t*${bps})))`
  execSync(
    `ffmpeg -f lavfi -i "aevalsrc=${expr}:s=44100" -t ${b.duration} "${out}"`,
    { stdio: 'inherit' }
  )
}

console.log(`\nDone. Test assets in: ${OUTPUT_DIR}`)
