export interface DateParts {
  year: number
  month: number
  day: number
}

export const parseDateKey = (value: string): DateParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const check = new Date(Date.UTC(year, month - 1, day))

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) return null

  return { year, month, day }
}

const getZonedParts = (instant: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

export const getLocalDateKey = (instant: Date, timeZone: string): string => {
  const parts = getZonedParts(instant, timeZone)
  return [
    String(parts.year).padStart(4, '0'),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
  ].join('-')
}

/**
 * Convert a wall-clock time in an IANA timezone into UTC.
 * Iterative offset resolution handles standard and daylight-saving offsets;
 * nonexistent local times (DST spring-forward gaps) are rejected.
 */
export const localDateTimeToUtc = (
  dateKey: string,
  time: string,
  timeZone: string,
): Date | null => {
  const date = parseDateKey(dateKey)
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time)
  if (!date || !timeMatch) return null

  const hour = Number(timeMatch[1])
  const minute = Number(timeMatch[2])
  if (hour > 23 || minute > 59) return null

  const target = Date.UTC(date.year, date.month - 1, date.day, hour, minute)
  let candidate = target

  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const zoned = getZonedParts(new Date(candidate), timeZone)
      const represented = Date.UTC(
        zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute,
      )
      candidate += target - represented
    }

    const resolved = getZonedParts(new Date(candidate), timeZone)
    if (
      resolved.year !== date.year ||
      resolved.month !== date.month ||
      resolved.day !== date.day ||
      resolved.hour !== hour ||
      resolved.minute !== minute
    ) return null

    return new Date(candidate)
  } catch {
    return null
  }
}

export const addMinutesToTime = (time: string, minutes: number): string | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return null

  const total = Number(match[1]) * 60 + Number(match[2]) + minutes
  if (total < 0 || total >= 24 * 60) return null

  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const minutesBetweenTimes = (start: string, end: string): number | null => {
  const parse = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value)
    if (!match) return null
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour > 23 || minute > 59) return null
    return hour * 60 + minute
  }

  const startMinutes = parse(start)
  const endMinutes = parse(end)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null
  return endMinutes - startMinutes
}

export const isValidIanaTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return true
  } catch {
    return false
  }
}
