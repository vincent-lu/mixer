import type { SegmentPlan, TransitionType } from './types'
import { DISSOLVE_DURATION, FLASH_FADE_DURATION } from './transitions'

interface SegmentGroup {
  segmentIndices: number[]
  transitionAfter: TransitionType | null
}

function groupSegments(transitions: TransitionType[]): SegmentGroup[] {
  const groups: SegmentGroup[] = []
  let currentIndices: number[] = [0]

  for (let i = 0; i < transitions.length; i++) {
    if (transitions[i] !== 'cut') {
      groups.push({ segmentIndices: currentIndices, transitionAfter: transitions[i]! })
      currentIndices = [i + 1]
    } else {
      currentIndices.push(i + 1)
    }
  }
  groups.push({ segmentIndices: currentIndices, transitionAfter: null })

  return groups
}

function segmentDuration(plan: SegmentPlan, idx: number): number {
  const seg = plan.segments[idx]!
  return seg.outpoint - seg.inpoint
}

export function buildFilterComplexArgs(
  plan: SegmentPlan,
  transitions: TransitionType[],
  bgmPath: string,
  outputPath: string,
): string[] {
  const { segments } = plan
  const bgmInputIndex = segments.length

  const inputArgs: string[] = ['-y']
  for (const seg of segments) {
    inputArgs.push('-ss', String(seg.inpoint), '-i', seg.sourcePath)
  }
  inputArgs.push('-i', bgmPath)

  const filterParts: string[] = []

  for (let i = 0; i < segments.length; i++) {
    let dur = segmentDuration(plan, i)
    if (i < transitions.length && transitions[i] === 'dissolve') {
      dur += DISSOLVE_DURATION
    }
    filterParts.push(`[${i}:v]trim=duration=${dur},setpts=PTS-STARTPTS,settb=AVTB[v${i}]`)
  }

  const groups = groupSegments(transitions)

  const groupLabels: string[] = []
  for (let gi = 0; gi < groups.length; gi++) {
    const { segmentIndices } = groups[gi]!
    if (segmentIndices.length === 1) {
      groupLabels.push(`v${segmentIndices[0]}`)
    } else {
      const inputs = segmentIndices.map((s) => `[v${s}]`).join('')
      const label = `g${gi}`
      filterParts.push(`${inputs}concat=n=${segmentIndices.length}:v=1:a=0[${label}]`)
      groupLabels.push(label)
    }
  }

  let prevLabel = groupLabels[0]!
  let accDur = groups[0]!.segmentIndices.reduce((sum, idx) => sum + segmentDuration(plan, idx), 0)
  if (groups[0]!.transitionAfter === 'dissolve') {
    accDur += DISSOLVE_DURATION
  }

  for (let ti = 0; ti < groups.length - 1; ti++) {
    const t = groups[ti]!.transitionAfter!
    const nextLabel = groupLabels[ti + 1]!
    const nextGroup = groups[ti + 1]!
    const nextDur = nextGroup.segmentIndices.reduce((sum, idx) => sum + segmentDuration(plan, idx), 0)

    if (t === 'dissolve') {
      const offset = (accDur - DISSOLVE_DURATION).toFixed(6)
      const outLabel = `x${ti}`
      filterParts.push(
        `[${prevLabel}][${nextLabel}]xfade=transition=fade:duration=${DISSOLVE_DURATION}:offset=${offset}[${outLabel}]`,
      )
      accDur = accDur + nextDur - DISSOLVE_DURATION
      if (nextGroup.transitionAfter === 'dissolve') accDur += DISSOLVE_DURATION
      prevLabel = outLabel
    } else if (t === 'flash') {
      const fadeSt = (accDur - FLASH_FADE_DURATION).toFixed(6)
      const fOut = `f${ti}a`
      const fIn = `f${ti}b`
      const outLabel = `x${ti}`
      filterParts.push(`[${prevLabel}]fade=t=out:st=${fadeSt}:d=${FLASH_FADE_DURATION}:color=white[${fOut}]`)
      filterParts.push(`[${nextLabel}]fade=t=in:st=0:d=${FLASH_FADE_DURATION}:color=white[${fIn}]`)
      filterParts.push(`[${fOut}][${fIn}]concat=n=2:v=1:a=0[${outLabel}]`)
      accDur += nextDur
      if (nextGroup.transitionAfter === 'dissolve') accDur += DISSOLVE_DURATION
      prevLabel = outLabel
    }
  }

  const filterComplex = filterParts.join(';\n')

  return [
    ...inputArgs,
    '-filter_complex',
    filterComplex,
    '-map',
    `[${prevLabel}]`,
    '-map',
    `${bgmInputIndex}:a:0`,
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-shortest',
    '-movflags',
    '+faststart',
    outputPath,
  ]
}
