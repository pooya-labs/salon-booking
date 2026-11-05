import { getIranTodayDateKey } from './jalali-date.ts'

export type TimeRange = { startsAt: string; endsAt: string }
export type DayOccupancy = { time: string; endTime: string }
export type DaySlot = {
  time: string
  endTime: string
  state: 'free' | 'booked' | 'blocked'
  title: string
}

const minuteOf = (value: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1]), minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}
const clockOf = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`

const overlaps = (start: number, end: number, range: DayOccupancy) => {
  const occupiedStart = minuteOf(range.time)
  const occupiedEnd = minuteOf(range.endTime)
  return occupiedStart !== null && occupiedEnd !== null && start < occupiedEnd && end > occupiedStart
}

export function buildDaySlots(
  intervals: TimeRange[],
  slotIntervalMinutes: number,
  bookings: Array<DayOccupancy & { serviceName?: string }> = [],
  blocks: DayOccupancy[] = [],
): DaySlot[] {
  const step = Number.isInteger(slotIntervalMinutes) && slotIntervalMinutes >= 5 ? slotIntervalMinutes : 15
  const slots: DaySlot[] = []
  for (const interval of intervals) {
    const start = minuteOf(interval.startsAt)
    const end = minuteOf(interval.endsAt)
    if (start === null || end === null || end <= start) continue
    for (let minute = start; minute < end; minute += step) {
      const next = Math.min(minute + step, end)
      const booking = bookings.find((item) => overlaps(minute, next, item))
      const block = blocks.find((item) => overlaps(minute, next, item))
      slots.push({
        time: clockOf(minute),
        endTime: clockOf(next),
        state: booking ? 'booked' : block ? 'blocked' : 'free',
        title: booking ? booking.serviceName || 'نوبت ثبت‌شده' : block ? 'مسدودشده توسط مدیر' : 'آزاد',
      })
    }
  }
  return slots
}

export function availableBlockDurations(
  date: string,
  time: string,
  durations: number[],
  intervals: TimeRange[],
  bookings: DayOccupancy[],
  blocks: DayOccupancy[],
  now: Date = new Date(),
): number[] {
  const start = minuteOf(time)
  if (start === null) return []
  const today = getIranTodayDateKey(now)
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const currentClock = timeParts.filter(part => part.type === 'hour' || part.type === 'minute').map(part => part.value).join(':')
  if (date < today || (date === today && time <= currentClock)) return []

  return durations.filter((duration) => {
    if (!Number.isInteger(duration) || duration < 5 || start + duration >= 1440) return false
    const end = start + duration
    const fitsWorkingHours = intervals.some((interval) => {
      const open = minuteOf(interval.startsAt), close = minuteOf(interval.endsAt)
      return open !== null && close !== null && start >= open && end <= close
    })
    if (!fitsWorkingHours) return false
    return !bookings.some((item) => overlaps(start, end, item))
      && !blocks.some((item) => overlaps(start, end, item))
  })
}

export function addClockMinutes(time: string, minutes: number): string | null {
  const start = minuteOf(time)
  if (start === null || !Number.isInteger(minutes) || start + minutes > 1439) return null
  return clockOf(start + minutes)
}
