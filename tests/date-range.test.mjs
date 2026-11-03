import assert from 'node:assert/strict'
import test from 'node:test'
import { addDateKeyDays } from '../src/date-range.ts'

test('shifts date keys across month and year boundaries', () => {
  assert.equal(addDateKeyDays('2026-11-03', 7), '2026-11-10')
  assert.equal(addDateKeyDays('2026-12-29', 7), '2027-01-05')
  assert.equal(addDateKeyDays('2027-01-05', -7), '2026-12-29')
})

test('handles leap days and month lengths', () => {
  assert.equal(addDateKeyDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDateKeyDays('2028-02-29', 1), '2028-03-01')
  assert.equal(addDateKeyDays('2027-02-28', 1), '2027-03-01')
})

test('rejects invalid date keys and unsafe offsets', () => {
  assert.equal(addDateKeyDays('2027-02-29', 1), null)
  assert.equal(addDateKeyDays('2027-13-01', 1), null)
  assert.equal(addDateKeyDays('not-a-date', 1), null)
  assert.equal(addDateKeyDays('2027-01-01', 1.5), null)
  assert.equal(addDateKeyDays('9999-12-31', 1), null)
})
