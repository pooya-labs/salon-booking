import assert from 'node:assert/strict'
import test from 'node:test'
import { formatJalaliDate, getIranTodayDateKey, getJalaliMonthGrid, gregorianToJalali, jalaliToGregorian } from '../src/jalali-date.ts'

test('Gregorian and Jalali conversion round-trip Nowruz 1405', () => {
  assert.deepEqual(gregorianToJalali('2026-03-21'), { year: 1405, month: 1, day: 1 })
  assert.equal(jalaliToGregorian({ year: 1405, month: 1, day: 1 }), '2026-03-21')
})
test('Jalali formatting uses Persian numerals and year/month/day order', () => {
  assert.equal(formatJalaliDate('2026-11-05'), '۱۴۰۵/۰۸/۱۴')
})
test('Jalali month grid starts on Saturday and contains all days once', () => {
  const cells = getJalaliMonthGrid(1405, 8)
  const days = cells.filter((day) => day !== null)
  assert.equal(days.length, 30)
  assert.deepEqual(days.map((day) => day.day), Array.from({ length: 30 }, (_, i) => i + 1))
  assert.equal((new Date(days[0].dateKey + 'T12:00:00Z').getUTCDay() + 1) % 7, 0)
})
test('Iran today key is a valid Gregorian ISO date', () => {
  assert.match(getIranTodayDateKey(), /^\d{4}-\d{2}-\d{2}$/)
})
test('invalid Jalali dates are rejected', () => {
  assert.equal(jalaliToGregorian({ year: 1405, month: 13, day: 1 }), null)
  assert.equal(jalaliToGregorian({ year: 1405, month: 1, day: 32 }), null)
})
