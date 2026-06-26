import type { ClipEffect } from '@shared/types'

export interface EffectAssignment {
  segmentIndex: number
  effect: ClipEffect
}

type EffectFilterFn = (segIndex: number) => string

function simpleAppend(filters: string): EffectFilterFn {
  return () => filters
}

// Assumes 1920x1080 output — all source videos are normalized to DEFAULT_PRESET (1080p) before mixing.
// Multi-part chains (`;`-separated): the last part must NOT carry an output label —
// filter.ts appends `[v${i}]` to it during assembly.
const EFFECT_FILTERS: Record<Exclude<ClipEffect, 'none'>, EffectFilterFn> = {
  shake: simpleAppend('scale=2208:1242,rotate=0.04*sin(t*8):c=black,crop=1920:1080'),
  shake_hard: simpleAppend('scale=2400:1350,rotate=0.08*sin(t*12):c=black,crop=1920:1080'),
  shake_blur: simpleAppend("scale=2208:1242,rotate=0.04*sin(t*8):c=black,crop=1920:1080,boxblur=lr=2:cr=2:enable='gt(abs(cos(t*8)),0.5)'"),
  zoompulse: simpleAppend('scale=w=iw*(1.08+0.08*sin(t*6*2*PI)):h=ih*(1.08+0.08*sin(t*6*2*PI)):eval=frame,crop=1920:1080'),
  kenburns: simpleAppend("scale=w='iw*(1+0.04*min(t,5))':h='ih*(1+0.04*min(t,5))':eval=frame,crop=1920:1080"),
  drift: simpleAppend('scale=2496:1080,crop=1920:1080:288+288*sin(t*PI/8):0'),
  vignette_pulse: simpleAppend('vignette=PI/4+PI/4*sin(t*4)'),
  hueshift: simpleAppend('hue=h=t*90'),
  flashpulse: simpleAppend('eq=brightness=0.3*abs(sin(t*10))*(1-abs(sin(t*10+PI/2)))'),
  negflash: simpleAppend("negate=negate_alpha=0:enable='if(gt(sin(t*8),0.9),1,0)'"),
  chromatic: (segIndex) => {
    const r = `cr${segIndex}`
    const g = `cg${segIndex}`
    const b = `cb${segIndex}`
    const rr = `crr${segIndex}`
    const gg = `cgg${segIndex}`
    const bb = `cbb${segIndex}`
    const rg = `crg${segIndex}`
    return [
      `split=3[${r}][${g}][${b}]`,
      `[${r}]lutrgb=g=0:b=0,crop=iw-20:ih:10+5*sin(t*6):0,pad=iw+20:ih:10[${rr}]`,
      `[${g}]lutrgb=r=0:b=0[${gg}]`,
      `[${b}]lutrgb=r=0:g=0,crop=iw-20:ih:10-5*sin(t*6):0,pad=iw+20:ih:10[${bb}]`,
      `[${rr}][${gg}]blend=all_mode=addition[${rg}]`,
      `[${rg}][${bb}]blend=all_mode=addition`,
    ].join(';')
  },
}

export function getEffectChain(effect: ClipEffect, segIndex: number): string | null {
  if (effect === 'none') return null
  return EFFECT_FILTERS[effect](segIndex)
}

export function assignEffects(
  segmentCount: number,
  effect: ClipEffect,
  chance: number,
): EffectAssignment[] {
  if (effect === 'none' || chance <= 0) return []
  const assignments: EffectAssignment[] = []
  for (let i = 0; i < segmentCount; i++) {
    if (Math.random() < chance / 100) {
      assignments.push({ segmentIndex: i, effect })
    }
  }
  return assignments
}
