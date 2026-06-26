import { describe, expect, it } from 'vitest'
import { buildFilterComplexArgs } from '../filter'
import type { Segment, SegmentPlan, TransitionType } from '../types'

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

describe('buildFilterComplexArgs', () => {
  it('includes correct number of inputs', () => {
    const plan = makePlan(4, 3)
    const transitions: TransitionType[] = ['cut', 'dissolve', 'cut']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const inputCount = args.filter((a) => a === '-i').length
    expect(inputCount).toBe(5) // 4 segments + 1 BGM
  })

  it('places output path last', () => {
    const plan = makePlan(3, 4)
    const transitions: TransitionType[] = ['cut', 'dissolve']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')
    expect(args.at(-1)).toBe('/out.mp4')
  })

  it('includes encoding args matching concat path', () => {
    const plan = makePlan(3, 4)
    const transitions: TransitionType[] = ['cut', 'dissolve']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    expect(args).toContain('-y')
    expect(args).toContain('libx264')
    expect(args).toContain('medium')
    expect(args).toContain('18')
    expect(args).toContain('aac')
    expect(args).toContain('192k')
    expect(args).toContain('-shortest')
    expect(args).toContain('+faststart')
  })

  it('maps BGM audio from correct input index', () => {
    const plan = makePlan(5, 3)
    const transitions: TransitionType[] = ['cut', 'cut', 'dissolve', 'cut']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const mapIndices = args.reduce<number[]>((acc, a, i) => {
      if (a === '-map') acc.push(i)
      return acc
    }, [])
    expect(mapIndices.length).toBe(2)
    expect(args[mapIndices[1]! + 1]).toBe('5:a:0')
  })

  it('contains trim and setpts for each segment', () => {
    const plan = makePlan(3, 4)
    const transitions: TransitionType[] = ['cut', 'dissolve']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]!

    expect(filter).toContain('[0:v]trim=duration=4,setpts=PTS-STARTPTS,settb=AVTB[v0]')
    expect(filter).toContain('[1:v]trim=duration=4.4,setpts=PTS-STARTPTS,settb=AVTB[v1]') // dissolve extension
    expect(filter).toContain('[2:v]trim=duration=4,setpts=PTS-STARTPTS,settb=AVTB[v2]')
  })

  it('groups consecutive cuts with concat filter', () => {
    const plan = makePlan(4, 3)
    const transitions: TransitionType[] = ['cut', 'dissolve', 'cut']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]!

    expect(filter).toContain('[v0][v1]concat=n=2:v=1:a=0[g0]')
    expect(filter).toContain('xfade=transition=fade:duration=0.4')
  })

  it('builds xfade with correct offset for dissolve', () => {
    // 2 segments of 5s each, dissolve between them
    const plan = makePlan(2, 5)
    const transitions: TransitionType[] = ['dissolve']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]!

    // Outgoing segment extended to 5.4s. Offset = 5.4 - 0.4 = 5.0
    expect(filter).toContain('[0:v]trim=duration=5.4,setpts=PTS-STARTPTS,settb=AVTB[v0]')
    expect(filter).toMatch(/xfade=transition=fade:duration=0\.4:offset=5\.0/)
  })

  it('builds fade+concat for flash transitions', () => {
    const plan = makePlan(2, 4)
    const transitions: TransitionType[] = ['flash']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]!

    expect(filter).toContain('fade=t=out')
    expect(filter).toContain('color=white')
    expect(filter).toContain('fade=t=in:st=0:d=0.06:color=white')
    expect(filter).toContain('concat=n=2:v=1:a=0')
  })

  it('handles all three transition types together', () => {
    const plan = makePlan(4, 3)
    const transitions: TransitionType[] = ['dissolve', 'flash', 'cut']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const filterIdx = args.indexOf('-filter_complex')
    const filter = args[filterIdx + 1]!

    expect(filter).toContain('xfade=transition=fade')
    expect(filter).toContain('fade=t=out')
    expect(filter).toContain('fade=t=in')
    expect(filter).toContain('[v2][v3]concat=n=2:v=1:a=0')
  })

  it('uses -ss for input seeking', () => {
    const plan = makePlan(3, 4)
    plan.segments[1]!.inpoint = 10
    plan.segments[1]!.outpoint = 14
    const transitions: TransitionType[] = ['dissolve', 'cut']
    const args = buildFilterComplexArgs(plan, transitions, '/bgm.mp3', '/out.mp4')

    const ssIndices = args.reduce<number[]>((acc, a, i) => {
      if (a === '-ss') acc.push(i)
      return acc
    }, [])
    expect(ssIndices.length).toBe(3)
    expect(args[ssIndices[1]! + 1]).toBe('10')
  })
})
