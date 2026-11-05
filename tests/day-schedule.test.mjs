import assert from 'node:assert/strict'
import test from 'node:test'
import { availableBlockDurations, buildDaySlots, addClockMinutes } from '../src/day-schedule.ts'

test('day view splits working intervals into readable 24-hour slots', () => {
  const slots = buildDaySlots([
    { startsAt: '09:00', endsAt: '10:00' },
    { startsAt: '11:00', endsAt: '11:30' },
  ], 15)
  assert.deepEqual(slots.map((slot) => slot.time), ['09:00', '09:15', '09:30', '09:45', '11:00', '11:15'])
})

test('bookings and manager blocks occupy their entire overlapping grid cells', () => {
  const slots = buildDaySlots([{ startsAt: '09:00', endsAt: '10:00' }], 15,
    [{ time: '09:15', endTime: '09:45', serviceName: 'کوتاهی مو' }],
    [{ time: '09:45', endTime: '10:00' }])
  assert.deepEqual(slots.map((slot) => slot.state), ['free', 'booked', 'booked', 'blocked'])
})

test('booking block durations must fit one working window and avoid all existing occupancy', () => {
  const durations = availableBlockDurations('2026-11-05', '10:00', [15, 30, 45, 60, 90],
    [{ startsAt: '09:00', endsAt: '12:00' }],
    [{ time: '10:45', endTime: '11:15' }],
    [{ time: '11:30', endTime: '12:00' }],
    new Date('2026-11-05T05:00:00Z'))
  assert.deepEqual(durations, [15, 30])
})

test('block duration cannot extend beyond midnight or into a break', () => {
  const durations = availableBlockDurations('2026-11-05', '12:30', [15, 30, 45, 60],
    [{ startsAt: '09:00', endsAt: '13:00' }, { startsAt: '15:00', endsAt: '21:00' }],
    [], [], new Date('2026-11-05T05:00:00Z'))
  assert.deepEqual(durations, [15, 30])
  assert.equal(addClockMinutes('23:45', 30), null)
})

test('a block cannot end at midnight because its end belongs to the following date', () => {
  assert.deepEqual(availableBlockDurations('2026-11-05', '23:45', [15], [
    { startsAt: '23:00', endsAt: '23:59' },
  ], [], [], new Date('2026-11-05T05:00:00Z')), [])
})
