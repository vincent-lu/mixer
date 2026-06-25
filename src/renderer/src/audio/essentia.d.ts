declare module 'essentia.js/dist/essentia.js-core.es.js' {
  class Essentia {
    constructor(wasmModule: unknown)
    arrayToVector(array: Float32Array): unknown
    audioBufferToMonoSignal(buffer: AudioBuffer): Float32Array
    PercivalBpmEstimator(
      signal: unknown,
      frameSize?: number,
      hopSize?: number,
      frameSizeOSS?: number,
      hopSizeOSS?: number,
      maxBPM?: number,
      minBPM?: number,
      sampleRate?: number,
    ): { bpm: number }
  }
  export default Essentia
}

declare module 'essentia.js/dist/essentia-wasm.web.js' {
  export default function EssentiaWASM(config?: {
    wasmBinary?: Uint8Array
  }): Promise<unknown>
}
