function shuffle(arr: string[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

export function allocateVideos(
  allVideos: string[],
  jobCount: number,
  videosPerJob: number,
): string[][] {
  if (jobCount === 0 || videosPerJob === 0 || allVideos.length === 0) return []

  const totalNeeded = jobCount * videosPerJob
  const sequence: string[] = []

  while (sequence.length < totalNeeded) {
    const deck = [...allVideos]
    shuffle(deck)
    sequence.push(...deck)
  }

  return Array.from({ length: jobCount }, (_, i) =>
    sequence.slice(i * videosPerJob, (i + 1) * videosPerJob),
  )
}
