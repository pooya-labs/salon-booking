/** Shift an ISO calendar date without relying on the browser's local timezone. */
export const addDateKeyDays = (value: string, amount: number): string | null => {
  if (!Number.isSafeInteger(amount)) return null
  const match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null

  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day + amount)
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return null

  const resultYear = String(date.getUTCFullYear()).padStart(4, '0')
  const resultMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  const resultDay = String(date.getUTCDate()).padStart(2, '0')
  const result = `${resultYear}-${resultMonth}-${resultDay}`

  return result === value && amount !== 0
    ? null
    : date.getUTCMonth() + 1 === month && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
      ? result
      : null
}
