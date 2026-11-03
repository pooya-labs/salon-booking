import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMinutesToTime,
  getLocalDateKey,
  isValidIanaTimeZone,
  localDateTimeToUtc,
  minutesBetweenTimes,
  parseDateKey,
} from '../worker/scheduling.ts'

test('validates Gregorian date keys, including leap days', () => {
  assert.deepEqual(parseDateKey('2028-02-29'), { year: 2028, month: 2, day: 29 })
  assert.equal(parseDateKey('2027-02-29'), null)
  assert.equal(parseDateKey('2026-13-01'), null)
  assert.equal(parseDateKey('03-11-2026'), null)
})

test('converts Tehran wall-clock time to UTC', () => {
  assert.equal(
    localDateTimeToUtc('2026-11-03', '09:00', 'Asia/Tehran')?.toISOString(),
    '2026-11-03T05:30:00.000Z',
  )
})

test('resolves daylight-saving offsets in Europe/Berlin', () => {
  assert.equal(
    localDateTimeToUtc('2026-01-15', '09:00', 'Europe/Berlin')?.toISOString(),
    '2026-01-15T08:00:00.000Z',
  )
  assert.equal(
    localDateTimeToUtc('2026-07-15', '09:00', 'Europe/Berlin')?.toISOString(),
    '2026-07-15T07:00:00.000Z',
  )
})

test('rejects nonexistent wall-clock times during daylight-saving transitions', () => {
  assert.equal(localDateTimeToUtc('2026-03-29', '02:30', 'Europe/Berlin'), null)
})

test('formats the local calendar date in the selected timezone', () => {
  assert.equal(getLocalDateKey(new Date('2026-11-03T00:30:00.000Z'), 'America/Los_Angeles'), '2026-11-02')
})

test('validates IANA timezone names', () => {
  assert.equal(isValidIanaTimeZone('Europe/Berlin'), true)
  assert.equal(isValidIanaTimeZone('Not/A_Timezone'), false)
})

test('adds minutes without allowing a booking to cross midnight', () => {
  assert.equal(addMinutesToTime('09:45', 75), '11:00')
  assert.equal(addMinutesToTime('23:30', 45), null)
  assert.equal(minutesBetweenTimes('09:00', '09:45'), 45)
  assert.equal(minutesBetweenTimes('10:00', '09:00'), null)
})
