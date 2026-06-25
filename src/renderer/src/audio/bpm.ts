import Essentia from 'essentia.js/dist/essentia.js-core.es.js'
import EssentiaWASM from 'essentia.js/dist/essentia-wasm.web.js'

let essentia: InstanceType<typeof Essentia> | null = null

async function getEssentia(): Promise<InstanceType<typeof Essentia>> {
  if (essentia) return essentia
  const wasmResponse = await fetch('/essentia/essentia-wasm.web.wasm')
  const wasmBinary = new Uint8Array(await wasmResponse.arrayBuffer())
  const wasmModule = await EssentiaWASM({ wasmBinary })
  essentia = new Essentia(wasmModule)
  return essentia
}

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export async function detectBpm(audioUrl: string): Promise<number | null> {
  try {
    const es = await getEssentia()
    const ctx = getAudioContext()
    const response = await fetch(audioUrl)
    const arrayBuffer = await response.arrayBuffer()
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const mono = es.audioBufferToMonoSignal(audioBuffer)
    const signal = es.arrayToVector(mono)
    const result = es.PercivalBpmEstimator(
      signal,
      1024,
      2048,
      512,
      1024,
      210,
      50,
      audioBuffer.sampleRate,
    )
    const bpm = result.bpm
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) return null
    return Math.round(bpm * 10) / 10
  } catch (e) {
    console.error('[bpm] detection failed:', e)
    return null
  }
}
