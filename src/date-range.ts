/** Shift a valid ISO calendar date without relying on the browser's local timezone. */
export const addDateKeyDays = (value: string, amount: number): string | null => {
  if (!Number.isSafeInteger(amount)) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  // Reject impossible input dates instead of allowing Date to normalize them.
  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) return null

  date.setUTCDate(date.getUTCDate() + amount)
  const resultYear = date.getUTCFullYear()
  if (Number.isNaN(date.getTime()) || resultYear < 1 || resultYear > 9999) return null

  const resultMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const resultDay = String(date.getUTCDate()).padStart(2, '0')
  return String(resultYear).padStart(4, '0') + '-' + resultMonth + '-' + resultDay
}
