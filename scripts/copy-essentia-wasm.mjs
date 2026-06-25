#!/usr/bin/env node
import { access, copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const SRC_DIR = 'node_modules/essentia.js/dist'
const DST_DIR = 'src/renderer/public/essentia'
const FILES = [
  'essentia-wasm.web.wasm',
]

await mkdir(DST_DIR, { recursive: true })

let copied = 0
let skipped = 0
for (const f of FILES) {
  const dst = join(DST_DIR, f)
  try {
    await access(dst)
    skipped++
  } catch {
    await copyFile(join(SRC_DIR, f), dst)
    copied++
  }
}

if (copied > 0) {
  console.log(`[essentia] copied ${copied} WASM files → ${DST_DIR}`)
} else {
  console.log(`[essentia] WASM already in place (${skipped} files)`)
}
