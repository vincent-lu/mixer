import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detectBeats, extractPcm } from '../audio'

const CLICK_120BPM = resolve(__dirname, '../../../../test-assets/click_120bpm_2min.mp3')

describe('extractPcm', () => {
  it('extracts mono f32 PCM from an audio file', async () => {
    const pcm = await extractPcm(CLICK_120BPM)

    expect(pcm).toBeInstanceOf(Float32Array)
    expect(pcm.length).toBeGreaterThan(44100)
  })
})

describe('detectBeats', () => {
  it('returns JS arrays, not essentia VectorFloat', async () => {
    const pcm = await extractPcm(CLICK_120BPM)
    const result = detectBeats(pcm)

    expect(Array.isArray(result.ticks)).toBe(true)
    expect(typeof result.confidence).toBe('number')
  })

  it('detects beats in a 120 BPM click track', async () => {
    const pcm = await extractPcm(CLICK_120BPM)
    const { ticks, confidence } = detectBeats(pcm)

    expect(ticks.length).toBeGreaterThan(200)
    expect(confidence).toBeGreaterThan(0)

    const intervals = ticks.slice(1).map((t, i) => t - ticks[i]!)
    const median = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)]!
    const bpm = 60 / median

    expect(bpm).toBeCloseTo(120, 0)
  })
})
