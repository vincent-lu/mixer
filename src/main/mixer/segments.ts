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

  const cursors = new Array<number>(probes.length).fill(0)
  const segments: Segment[] = []
  const sourceIndices = probes.map((_, i) => i)

  let lastAssigned = -1

  for (let i = 0; i < segmentCount; ) {
    let deck = shuffle(sourceIndices)

    // Anti-consecutive: reshuffle if first of this round matches last of previous
    for (let attempt = 0; attempt < 5 && deck[0] === lastAssigned; attempt++) {
      deck = shuffle(sourceIndices)
    }

    for (let j = 0; j < deck.length && i < segmentCount; j++, i++) {
      const sourceIndex = deck[j]!
      const probe = probes[sourceIndex]!
      const segDuration = sectionTimings[i + 1]! - sectionTimings[i]!

      // Wrap cursor if remaining source video is too short
      if (cursors[sourceIndex]! + segDuration > probe.duration) {
        cursors[sourceIndex] = 0
      }

      const inpoint = cursors[sourceIndex]!
      const outpoint = segDuration >= probe.duration
        ? probe.duration
        : inpoint + segDuration

      segments.push({
        sourceIndex,
        sourcePath: probe.path,
        inpoint,
        outpoint,
      })

      cursors[sourceIndex] = outpoint
      lastAssigned = sourceIndex
    }
  }

  return { segments, totalDuration: bgmDuration }
}
