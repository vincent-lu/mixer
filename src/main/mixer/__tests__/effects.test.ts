import { describe, expect, it } from 'vitest'
import { assignEffects, getEffectChain } from '../effects'

describe('getEffectChain', () => {
  it('returns null for none', () => {
    expect(getEffectChain('none', 0)).toBeNull()
  })

  it('returns a single-part chain for simple effects', () => {
    const chain = getEffectChain('shake', 3)
    expect(chain).not.toBeNull()
    expect(chain!.includes(';')).toBe(false)
    expect(chain).toContain('scale=')
    expect(chain).toContain('rotate=')
    expect(chain).toContain('crop=1920:1080')
  })

  it('returns a multi-part chain for chromatic', () => {
    const chain = getEffectChain('chromatic', 5)
    expect(chain).not.toBeNull()
    expect(chain!.includes(';')).toBe(true)
    const parts = chain!.split(';')
    expect(parts.length).toBe(6)
    expect(parts[0]).toContain('split=3')
  })

  it('chromatic uses unique labels per segment index', () => {
    const chain3 = getEffectChain('chromatic', 3)!
    const chain7 = getEffectChain('chromatic', 7)!
    expect(chain3).toContain('[cr3]')
    expect(chain3).toContain('[cg3]')
    expect(chain3).toContain('[crg3]')
    expect(chain7).toContain('[cr7]')
    expect(chain7).toContain('[cg7]')
    expect(chain7).toContain('[crg7]')
    expect(chain3).not.toContain('[cr7]')
    expect(chain7).not.toContain('[cr3]')
  })

  it('zoompulse includes eval=frame', () => {
    const chain = getEffectChain('zoompulse', 0)!
    expect(chain).toContain('eval=frame')
  })

  it('kenburns includes eval=frame and caps zoom', () => {
    const chain = getEffectChain('kenburns', 0)!
    expect(chain).toContain('eval=frame')
    expect(chain).toContain('min(t,5)')
  })

  it('returns a chain for every non-none effect', () => {
    const effects = [
      'shake', 'shake_hard', 'shake_blur', 'zoompulse', 'kenburns',
      'drift', 'vignette_pulse', 'hueshift', 'flashpulse', 'negflash', 'chromatic',
    ] as const
    for (const effect of effects) {
      const chain = getEffectChain(effect, 0)
      expect(chain, `${effect} should return a chain`).not.toBeNull()
      expect(chain!.length).toBeGreaterThan(0)
    }
  })
})

describe('assignEffects', () => {
  it('returns empty for none effect', () => {
    expect(assignEffects(10, 'none', 50)).toEqual([])
  })

  it('returns empty for chance 0', () => {
    expect(assignEffects(10, 'shake', 0)).toEqual([])
  })

  it('returns empty for negative chance', () => {
    expect(assignEffects(10, 'shake', -1)).toEqual([])
  })

  it('assigns all segments at chance 100', () => {
    const assignments = assignEffects(5, 'hueshift', 100)
    expect(assignments).toHaveLength(5)
    for (let i = 0; i < 5; i++) {
      expect(assignments[i]!.segmentIndex).toBe(i)
      expect(assignments[i]!.effect).toBe('hueshift')
    }
  })

  it('assigns subset at intermediate chance', () => {
    const results = Array.from({ length: 20 }, () => assignEffects(100, 'shake', 50))
    const counts = results.map((r) => r.length)
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length
    expect(avg).toBeGreaterThan(20)
    expect(avg).toBeLessThan(80)
  })

  it('segment indices are valid', () => {
    const assignments = assignEffects(10, 'drift', 100)
    for (const a of assignments) {
      expect(a.segmentIndex).toBeGreaterThanOrEqual(0)
      expect(a.segmentIndex).toBeLessThan(10)
    }
  })
})
