import type { AnalysisResult } from '@shared/types'
import type { ProbeResult, Segment, SegmentPlan } from './types'

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i]!, result[j]!] = [result[j]!, result[i]!]
  }
  return result
}

export function buildSegmentPlan(
  analysis: AnalysisResult,
  probes: ProbeResult[],
): SegmentPlan {
  const { sectionTimings, bgmDuration } = analysis
  const segmentCount = sectionTimings.length - 1
  if (segmentCount <= 0 || probes.length === 0) return { segments: [], totalDuration: bgmDuration }

  const sourceIndices = probes.map((_, i) => i)

  // Pass 1: Assign sources via shuffled round-robin
  const assignments: { sourceIndex: number; segDuration: number }[] = []
  let lastAssigned = -1

  for (let i = 0; i < segmentCount; ) {
    let deck = shuffle(sourceIndices)

    for (let attempt = 0; attempt < 5 && deck[0] === lastAssigned; attempt++) {
      deck = shuffle(sourceIndices)
    }

    for (let j = 0; j < deck.length && i < segmentCount; j++, i++) {
      assignments.push({
        sourceIndex: deck[j]!,
        segDuration: sectionTimings[i + 1]! - sectionTimings[i]!,
      })
      lastAssigned = deck[j]!
    }
  }

  // Pass 2: Compute stride per source — spread cursor evenly across the video
  const assignedCounts = new Array<number>(probes.length).fill(0)
  for (const a of assignments) assignedCounts[a.sourceIndex]!++

  const strides = probes.map((p, i) => {
    const count = assignedCounts[i]!
    return count > 0 ? p.duration / count : 0
  })

  // Pass 3: Build segments with proportional cursor advancement
  const cursors = new Array<number>(probes.length).fill(0)
  const segments: Segment[] = []

  for (const a of assignments) {
    const probe = probes[a.sourceIndex]!
    const inpoint = cursors[a.sourceIndex]!
    const outpoint = Math.min(inpoint + a.segDuration, probe.duration)

    segments.push({
      sourceIndex: a.sourceIndex,
      sourcePath: probe.path,
      inpoint,
      outpoint,
    })

    cursors[a.sourceIndex]! += strides[a.sourceIndex]!
  }

  return { segments, totalDuration: bgmDuration }
}
