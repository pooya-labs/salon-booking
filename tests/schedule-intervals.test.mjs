import assert from 'node:assert/strict'
import test from 'node:test'
import { nextAvailableInterval } from '../src/schedule-intervals.ts'

test('empty day receives a usable default interval', () => {
  assert.deepEqual(nextAvailableInterval([]), { startsAt: '09:00', endsAt: '17:00' })
})
test('new interval appends after existing hours without overlap', () => {
  assert.deepEqual(nextAvailableInterval([{ startsAt: '09:00', endsAt: '13:00' }]), { startsAt: '13:00', endsAt: '14:00' })
})
test('when the tail is full, an available gap between intervals is reused', () => {
  assert.deepEqual(nextAvailableInterval([{ startsAt: '09:00', endsAt: '12:00' }, { startsAt: '18:00', endsAt: '23:59' }]), { startsAt: '12:00', endsAt: '13:00' })
})
test('fully occupied day returns no interval', () => {
  assert.equal(nextAvailableInterval([{ startsAt: '00:00', endsAt: '23:59' }]), null)
})
