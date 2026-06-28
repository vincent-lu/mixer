import { describe, expect, it } from 'vitest'
import { buildFilterComplexArgs } from '../filter'
import type { Segment, SegmentPlan, TransitionAssignment } from '../types'
import type { EffectAssignment } from '../effects'

function makePlan(count: number, segDur: number): SegmentPlan {
  const segments: Segment[] = []
  for (let i = 0; i < count; i++) {
    segments.push({
      sourceIndex: i % 3,
      sourcePath: `/videos/v${i % 3}.mp4`,
      inpoint: i * 2,
      outpoint: i * 2 + segDur,
    })
  }
  return { segments, totalDuration: count * segDur }
}

const CUT: TransitionAssignment = { type: 'cut', duration: 0 }

function xfade(type = 'fade', duration = 0.4): TransitionAssignment {
  return { type, duration }
}

function flash(): TransitionAssignment {
  return { type: 'flash', duration: 0.06 }
}

describe('buildFilterComplexArgs', () => {
  it('deduplicates input files', () => {
    const plan = makePlan(4, 3)
    const transitions = [CUT, xfade('wipeleft', 0.5), CUT]
    const { inputArgs } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const inputCount = inputArgs.filter((a) => a === '-i').length
    expect(inputCount).toBe(4)
    expect(inputArgs).not.toContain('-ss')
  })

  it('places output path last in outputArgs', () => {
    const plan = makePlan(3, 4)
    const transitions = [CUT, xfade('dissolve', 0.6)]
    const { outputArgs } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')
    expect(outputArgs.at(-1)).toBe('/out.mp4')
  })

  it('includes encoding args matching concat path', () => {
    const plan = makePlan(3, 4)
    const transitions = [CUT, xfade()]
    const { inputArgs, outputArgs } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')
    const args = [...inputArgs, ...outputArgs]

    expect(args).toContain('-y')
    expect(outputArgs).toContain('libx264')
    expect(outputArgs).toContain('medium')
    expect(outputArgs).toContain('18')
    expect(outputArgs).toContain('aac')
    expect(outputArgs).toContain('192k')
    expect(outputArgs).toContain('-shortest')
    expect(outputArgs).toContain('+faststart')
  })

  it('maps BGM audio from correct input index', () => {
    const plan = makePlan(5, 3)
    const transitions = [CUT, CUT, xfade('circleopen', 0.7), CUT]
    const { outputArgs } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const mapIndices = outputArgs.reduce<number[]>((acc, a, i) => {
      if (a === '-map') acc.push(i)
      return acc
    }, [])
    expect(mapIndices.length).toBe(2)
    expect(outputArgs[mapIndices[1]! + 1]).toBe('3:a:0')
  })

  it('uses trim=start for seeking in filter script', () => {
    const plan = makePlan(3, 4)
    const transitions = [CUT, xfade('fade', 0.4)]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toContain('[0:v]trim=start=0:duration=4,setpts=PTS-STARTPTS,settb=AVTB,fps=30,setsar=1[v0]')
    expect(filterScript).toContain('trim=start=2:duration=4.4,setpts=PTS-STARTPTS,settb=AVTB,fps=30,setsar=1[v1]')
    expect(filterScript).toContain('trim=start=4:duration=4,setpts=PTS-STARTPTS,settb=AVTB,fps=30,setsar=1[v2]')
  })

  it('groups consecutive cuts with concat filter', () => {
    const plan = makePlan(4, 3)
    const transitions = [CUT, xfade('wiperight', 0.5), CUT]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toContain('[v0][v1]concat=n=2:v=1:a=0,settb=1/30[g0]')
    expect(filterScript).toContain('xfade=transition=wiperight:duration=0.5')
    expect(filterScript).toMatch(/xfade=.*,settb=1\/30\[x0\]/)
  })

  it('uses variable xfade transition type and duration', () => {
    const plan = makePlan(2, 5)
    const transitions = [xfade('circleopen', 0.7)]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toMatch(/trim=start=0:duration=5\.7/)
    expect(filterScript).toMatch(/xfade=transition=circleopen:duration=0\.7:offset=5\.0/)
  })

  it('builds xfade with correct offset for dissolve', () => {
    const plan = makePlan(2, 5)
    const transitions = [xfade('fade', 0.4)]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toMatch(/trim=start=0:duration=5\.4/)
    expect(filterScript).toMatch(/xfade=transition=fade:duration=0\.4:offset=5\.0/)
  })

  it('builds fade+concat for flash transitions', () => {
    const plan = makePlan(2, 4)
    const transitions = [flash()]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toContain('fade=t=out')
    expect(filterScript).toContain('color=white')
    expect(filterScript).toContain('fade=t=in:st=0:d=0.06:color=white')
    expect(filterScript).toContain('concat=n=2:v=1:a=0,settb=1/30')
  })

  it('handles multiple transition types together', () => {
    const plan = makePlan(4, 3)
    const transitions = [xfade('slideright', 0.5), flash(), CUT]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(filterScript).toContain('xfade=transition=slideright')
    expect(filterScript).toContain('fade=t=out')
    expect(filterScript).toContain('fade=t=in')
    expect(filterScript).toContain('[v2][v3]concat=n=2:v=1:a=0,settb=1/30')
  })

  it('emits split filter for deduplicated inputs and references correct labels', () => {
    const plan = makePlan(4, 3)
    const transitions = [CUT, xfade('wipeleft', 0.5), CUT]
    const { filterScript, inputArgs } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(inputArgs.filter((a) => a === '-i').length).toBe(4)
    expect(filterScript).toContain('[0:v]split=2[s0_0][s0_1]')
    expect(filterScript).toContain('[s0_0]trim=start=0:duration=3')
    expect(filterScript).toContain('[s0_1]trim=start=6:duration=3')
    expect(filterScript).toContain('[1:v]trim=start=2:duration=3')
  })

  it('appends simple effect chain to segment', () => {
    const plan = makePlan(3, 4)
    const transitions = [CUT, CUT]
    const effects: EffectAssignment[] = [{ segmentIndex: 1, effect: 'hueshift' }]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4', effects)

    expect(filterScript).toContain('setsar=1,hue=h=t*90[v1]')
    expect(filterScript).toContain('settb=AVTB,fps=30,setsar=1[v0]')
    expect(filterScript).toContain('settb=AVTB,fps=30,setsar=1[v2]')
  })

  it('handles chromatic multi-stream effect', () => {
    const plan = makePlan(2, 4)
    const transitions = [CUT]
    const effects: EffectAssignment[] = [{ segmentIndex: 0, effect: 'chromatic' }]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4', effects)

    expect(filterScript).toContain('split=3[cr0][cg0][cb0]')
    expect(filterScript).toContain('[cr0]lutrgb=g=0:b=0')
    expect(filterScript).toContain('blend=all_mode=addition[v0]')
    expect(filterScript).toContain('settb=AVTB,fps=30,setsar=1[v1]')
  })

  it('composes effects with transitions', () => {
    const plan = makePlan(3, 4)
    const transitions = [xfade('fade', 0.4), CUT]
    const effects: EffectAssignment[] = [{ segmentIndex: 0, effect: 'vignette_pulse' }]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4', effects)

    expect(filterScript).toContain('setsar=1,vignette=PI/4+PI/4*sin(t*4)[v0]')
    expect(filterScript).toContain('xfade=transition=fade')
  })

  it('effects-only path includes all segments', () => {
    const plan = makePlan(4, 3)
    const transitions = [CUT, CUT, CUT]
    const effects: EffectAssignment[] = [{ segmentIndex: 2, effect: 'shake' }]
    const { filterScript } = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4', effects)

    expect(filterScript).toContain('[v0]')
    expect(filterScript).toContain('[v1]')
    expect(filterScript).toContain('[v2]')
    expect(filterScript).toContain('[v3]')
    expect(filterScript).toContain('concat=n=4')
  })
})
