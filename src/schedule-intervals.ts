export type TimeInterval = { startsAt: string; endsAt: string }

const toMinutes = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1]), minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}
const fromMinutes = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export function nextAvailableInterval(intervals: TimeInterval[]): TimeInterval | null {
  if (intervals.length === 0) return { startsAt: '09:00', endsAt: '17:00' }
  const sorted = [...intervals]
    .map((interval) => ({ start: toMinutes(interval.startsAt), end: toMinutes(interval.endsAt) }))
    .filter((interval): interval is { start: number; end: number } =>
      interval.start !== null && interval.end !== null && interval.end > interval.start)
    .sort((a, b) => a.start - b.start)
  if (sorted.length === 0) return { startsAt: '09:00', endsAt: '17:00' }

  const lastEnd = sorted[sorted.length - 1].end
  const tailGap = 1439 - lastEnd
  if (tailGap >= 15) {
    const duration = Math.min(60, tailGap)
    return { startsAt: fromMinutes(lastEnd), endsAt: fromMinutes(lastEnd + duration) }
  }
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const gapStart = sorted[index].end
    const gap = sorted[index + 1].start - gapStart
    if (gap >= 15) {
      const duration = Math.min(60, gap)
      return { startsAt: fromMinutes(gapStart), endsAt: fromMinutes(gapStart + duration) }
    }
  }
  return null
}
