import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { computePerBeatEnergy, detectBeats, detectOnsets, extractPcm } from '../audio'

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

describe('detectOnsets', () => {
  it('returns a sorted array of non-negative onset times', async () => {
    const pcm = await extractPcm(CLICK_120BPM)
    const onsets = detectOnsets(pcm)

    expect(Array.isArray(onsets)).toBe(true)
    expect(onsets.length).toBeGreaterThan(0)
    for (const t of onsets) {
      expect(t).toBeGreaterThanOrEqual(0)
    }
    for (let i = 1; i < onsets.length; i++) {
      expect(onsets[i]).toBeGreaterThanOrEqual(onsets[i - 1]!)
    }
    expect(onsets[onsets.length - 1]!).toBeLessThan(130)
  })
})

describe('computePerBeatEnergy', () => {
  it('returns one RMS value per tick with positive values', () => {
    const sampleRate = 44100
    const duration = 1
    const pcm = new Float32Array(sampleRate * duration)
    for (let i = 0; i < pcm.length; i++) {
      pcm[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate))
    }

    const ticks = [0.25, 0.5, 0.75]
    const energies = computePerBeatEnergy(pcm, ticks)

    expect(energies.length).toBe(ticks.length)
    for (const e of energies) {
      expect(e).toBeGreaterThan(0)
    }
  })

  it('reports higher energy for louder sections', () => {
    const sampleRate = 44100
    const pcm = new Float32Array(sampleRate * 2)
    for (let i = 0; i < sampleRate; i++) {
      pcm[i] = 0.1 * Math.sin(2 * Math.PI * 440 * (i / sampleRate))
    }
    for (let i = sampleRate; i < pcm.length; i++) {
      pcm[i] = 0.9 * Math.sin(2 * Math.PI * 440 * (i / sampleRate))
    }

    const energies = computePerBeatEnergy(pcm, [0.5, 1.5])

    expect(energies[0]).toBeLessThan(energies[1]!)
  })

  it('handles ticks near PCM boundaries', () => {
    const sampleRate = 44100
    const pcm = new Float32Array(sampleRate)
    for (let i = 0; i < pcm.length; i++) {
      pcm[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate))
    }

    const energies = computePerBeatEnergy(pcm, [0.0, 0.99])

    expect(energies.length).toBe(2)
    for (const e of energies) {
      expect(e).toBeGreaterThan(0)
    }
  })
})
