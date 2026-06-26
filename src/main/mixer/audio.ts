import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const SAMPLE_RATE = 44100

interface EssentiaInstance {
  arrayToVector(array: Float32Array): unknown
  vectorToArray(vector: unknown): Float32Array
  BeatTrackerMultiFeature(
    signal: unknown,
    maxTempo?: number,
    minTempo?: number,
  ): { ticks: unknown; confidence: number }
  SuperFluxExtractor(signal: unknown): { onsets: unknown }
  RMS(signal: unknown): { rms: number }
}

let essentiaInstance: EssentiaInstance | null = null

function getEssentia(): EssentiaInstance {
  if (essentiaInstance) return essentiaInstance
  const require = createRequire(import.meta.url)
  const mod = require('essentia.js') as {
    Essentia: new (wasmModule: unknown) => EssentiaInstance
    EssentiaWASM: unknown
  }
  essentiaInstance = new mod.Essentia(mod.EssentiaWASM)
  return essentiaInstance
}

export async function extractPcm(bgmPath: string): Promise<Float32Array> {
  const { stdout } = await execFileAsync(
    'ffmpeg',
    ['-i', bgmPath, '-f', 'f32le', '-acodec', 'pcm_f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), 'pipe:1'],
    { encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 },
  )
  return new Float32Array(stdout.buffer, stdout.byteOffset, stdout.byteLength / 4)
}

export function detectBeats(pcm: Float32Array): { ticks: number[]; confidence: number } {
  const essentia = getEssentia()
  const signal = essentia.arrayToVector(pcm)
  const result = essentia.BeatTrackerMultiFeature(signal, 208, 40)
  return {
    ticks: Array.from(essentia.vectorToArray(result.ticks)),
    confidence: result.confidence,
  }
}

export function detectOnsets(pcm: Float32Array): number[] {
  const essentia = getEssentia()
  const signal = essentia.arrayToVector(pcm)
  const result = essentia.SuperFluxExtractor(signal)
  return Array.from(essentia.vectorToArray(result.onsets))
}

const HALF_WINDOW_SAMPLES = Math.round(0.05 * SAMPLE_RATE)

export function computePerBeatEnergy(pcm: Float32Array, ticks: number[]): number[] {
  const essentia = getEssentia()
  return ticks.map((tick) => {
    const center = Math.round(tick * SAMPLE_RATE)
    const start = Math.max(0, center - HALF_WINDOW_SAMPLES)
    const end = Math.min(pcm.length, center + HALF_WINDOW_SAMPLES)
    if (start >= end) return 0
    const frame = pcm.slice(start, end)
    const vec = essentia.arrayToVector(frame)
    return essentia.RMS(vec).rms
  })
}
