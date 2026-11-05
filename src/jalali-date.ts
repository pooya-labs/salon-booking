export type JalaliDateParts = { year: number; month: number; day: number }
export type JalaliCalendarDay = { day: number; dateKey: string }

const PERSIAN_CALENDAR = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  calendar: 'persian', timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric',
})
const IRAN_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
})
const DAY_MS = 24 * 60 * 60 * 1000

const readCalendarParts = (date: Date): JalaliDateParts => {
  const values: Record<string, number> = {}
  for (const part of PERSIAN_CALENDAR.formatToParts(date)) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') values[part.type] = Number(part.value)
  }
  return { year: values.year, month: values.month, day: values.day }
}

const parseIsoDate = (dateKey: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day, 12))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  return date
}

const toIsoDate = (date: Date) => date.toISOString().slice(0, 10)

export const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)])

export function gregorianToJalali(dateKey: string): JalaliDateParts | null {
  const date = parseIsoDate(dateKey)
  return date ? readCalendarParts(date) : null
}

export function jalaliToGregorian(parts: JalaliDateParts): string | null {
  const { year, month, day } = parts
  if (!Number.isInteger(year) || year < 1200 || year > 1600 ||
      !Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(day) || day < 1 || day > 31) return null
  const first = Date.UTC(year + 621, 2, 18, 12)
  const last = Date.UTC(year + 622, 2, 28, 12)
  for (let timestamp = first; timestamp <= last; timestamp += DAY_MS) {
    const date = new Date(timestamp)
    const current = readCalendarParts(date)
    if (current.year === year && current.month === month && current.day === day) return toIsoDate(date)
  }
  return null
}

export function formatJalaliDate(dateKey: string): string {
  const parts = gregorianToJalali(dateKey)
  if (!parts) return dateKey
  return `${toPersianDigits(parts.year)}/${toPersianDigits(String(parts.month).padStart(2, '0'))}/${toPersianDigits(String(parts.day).padStart(2, '0'))}`
}

export function getIranTodayDateKey(now = new Date()): string {
  const values: Record<string, string> = {}
  for (const part of IRAN_DATE.formatToParts(now)) {
    if (part.type === 'year' || part.type === 'month' || part.type === 'day') values[part.type] = part.value
  }
  return `${values.year}-${values.month}-${values.day}`
}

export function getJalaliMonthGrid(year: number, month: number): Array<JalaliCalendarDay | null> {
  if (!Number.isInteger(month) || month < 1 || month > 12) return []
  const firstDate = jalaliToGregorian({ year, month, day: 1 })
  if (!firstDate) return []
  const first = parseIsoDate(firstDate)!
  const leadingCells = (first.getUTCDay() + 1) % 7
  const cells: Array<JalaliCalendarDay | null> = Array.from({ length: leadingCells }, () => null)
  const firstTimestamp = first.getTime()
  for (let offset = 0; offset < 31; offset += 1) {
    const date = new Date(firstTimestamp + offset * DAY_MS)
    const dateKey = toIsoDate(date)
    const parts = readCalendarParts(date)
    if (parts.year !== year || parts.month !== month) break
    cells.push({ day: parts.day, dateKey })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
