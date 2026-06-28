import type { SegmentPlan, TransitionAssignment } from './types'
import { DEFAULT_PRESET } from './normalize'
import { CUSTOM_TRANSITION_EXPRS, FLASH_FADE_DURATION } from './transitions'
import type { TransitionEffect } from '@shared/types'
import type { EffectAssignment } from './effects'
import { getEffectChain } from './effects'

interface SegmentGroup {
  segmentIndices: number[]
  transitionAfter: TransitionAssignment | null
}

function groupSegments(transitions: TransitionAssignment[]): SegmentGroup[] {
  const groups: SegmentGroup[] = []
  let currentIndices: number[] = [0]

  for (let i = 0; i < transitions.length; i++) {
    if (transitions[i]!.type !== 'cut') {
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

function isXfade(t: TransitionAssignment): boolean {
  return t.type !== 'cut' && t.type !== 'flash'
}

export interface FilterComplexResult {
  inputArgs: string[]
  filterScript: string
  outputArgs: string[]
}

export function buildFilterComplexArgs(
  plan: SegmentPlan,
  transitions: TransitionAssignment[],
  bgmPath: string,
  outputPath: string,
  effectAssignments: EffectAssignment[] = [],
): FilterComplexResult {
  const { segments } = plan

  const uniquePaths = [...new Set(segments.map((s) => s.sourcePath))]
  const pathToInput = new Map(uniquePaths.map((p, i) => [p, i]))
  const bgmInputIndex = uniquePaths.length

  const inputArgs: string[] = ['-y']
  for (const path of uniquePaths) {
    inputArgs.push('-i', path)
  }
  inputArgs.push('-i', bgmPath)

  const filterParts: string[] = []

  // Count how many times each input is used and assign split labels
  const inputUseCounts = new Map<number, number>()
  for (const seg of segments) {
    const idx = pathToInput.get(seg.sourcePath)!
    inputUseCounts.set(idx, (inputUseCounts.get(idx) ?? 0) + 1)
  }

  // Emit split filters for inputs used more than once
  const inputUseCounters = new Map<number, number>()
  const splitLabels = new Map<number, string[]>()
  for (const [inputIdx, count] of inputUseCounts) {
    if (count > 1) {
      const labels = Array.from({ length: count }, (_, j) => `s${inputIdx}_${j}`)
      filterParts.push(`[${inputIdx}:v]split=${count}${labels.map((l) => `[${l}]`).join('')}`)
      splitLabels.set(inputIdx, labels)
      inputUseCounters.set(inputIdx, 0)
    }
  }

  const effectMap = new Map(effectAssignments.map((a) => [a.segmentIndex, a.effect]))

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!
    const inputIdx = pathToInput.get(seg.sourcePath)!
    let dur = segmentDuration(plan, i)
    if (i < transitions.length && isXfade(transitions[i]!)) {
      dur += transitions[i]!.duration
    }

    let inputLabel: string
    const labels = splitLabels.get(inputIdx)
    if (labels) {
      const useIdx = inputUseCounters.get(inputIdx)!
      inputLabel = `[${labels[useIdx]}]`
      inputUseCounters.set(inputIdx, useIdx + 1)
    } else {
      inputLabel = `[${inputIdx}:v]`
    }

    const baseChain = `${inputLabel}trim=start=${seg.inpoint}:duration=${dur},setpts=PTS-STARTPTS,settb=AVTB,fps=${DEFAULT_PRESET.fps},setsar=1`
    const effect = effectMap.get(i)
    const effectChain = effect ? getEffectChain(effect, i) : null
    if (effectChain) {
      const parts = effectChain.split(';')
      filterParts.push(`${baseChain},${parts[0]}${parts.length === 1 ? `[v${i}]` : ''}`)
      for (let p = 1; p < parts.length - 1; p++) {
        filterParts.push(parts[p]!)
      }
      if (parts.length > 1) {
        filterParts.push(`${parts[parts.length - 1]}[v${i}]`)
      }
    } else {
      filterParts.push(`${baseChain}[v${i}]`)
    }
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
      filterParts.push(`${inputs}concat=n=${segmentIndices.length}:v=1:a=0,settb=AVTB[${label}]`)
      groupLabels.push(label)
    }
  }

  let prevLabel = groupLabels[0]!
  let accDur = groups[0]!.segmentIndices.reduce((sum, idx) => sum + segmentDuration(plan, idx), 0)
  const firstTransition = groups[0]!.transitionAfter
  if (firstTransition && isXfade(firstTransition)) {
    accDur += firstTransition.duration
  }

  for (let ti = 0; ti < groups.length - 1; ti++) {
    const t = groups[ti]!.transitionAfter!
    const nextLabel = groupLabels[ti + 1]!
    const nextGroup = groups[ti + 1]!
    const nextDur = nextGroup.segmentIndices.reduce((sum, idx) => sum + segmentDuration(plan, idx), 0)

    if (isXfade(t)) {
      const offset = (accDur - t.duration).toFixed(6)
      const outLabel = `x${ti}`
      const customExpr = CUSTOM_TRANSITION_EXPRS[t.type as TransitionEffect]
      const xfadeParams = customExpr
        ? `transition=custom:expr='${customExpr}':duration=${t.duration}:offset=${offset}`
        : `transition=${t.type}:duration=${t.duration}:offset=${offset}`
      filterParts.push(
        `[${prevLabel}][${nextLabel}]xfade=${xfadeParams},settb=AVTB[${outLabel}]`,
      )
      accDur = accDur + nextDur - t.duration
      const nextTransition = nextGroup.transitionAfter
      if (nextTransition && isXfade(nextTransition)) accDur += nextTransition.duration
      prevLabel = outLabel
    } else if (t.type === 'flash') {
      const fadeSt = (accDur - FLASH_FADE_DURATION).toFixed(6)
      const fOut = `f${ti}a`
      const fIn = `f${ti}b`
      const outLabel = `x${ti}`
      filterParts.push(`[${prevLabel}]fade=t=out:st=${fadeSt}:d=${FLASH_FADE_DURATION}:color=white[${fOut}]`)
      filterParts.push(`[${nextLabel}]fade=t=in:st=0:d=${FLASH_FADE_DURATION}:color=white[${fIn}]`)
      filterParts.push(`[${fOut}][${fIn}]concat=n=2:v=1:a=0,settb=AVTB[${outLabel}]`)
      accDur += nextDur
      const nextTransition = nextGroup.transitionAfter
      if (nextTransition && isXfade(nextTransition)) accDur += nextTransition.duration
      prevLabel = outLabel
    }
  }

  const filterScript = filterParts.join(';\n')

  return {
    inputArgs,
    filterScript,
    outputArgs: [
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
  ],
  }
}
