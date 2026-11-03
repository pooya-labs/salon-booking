import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizePhoneNumber } from '../src/phone.ts'

test('normalizes Persian and Arabic numerals to ASCII digits', () => {
  assert.equal(normalizePhoneNumber('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789')
  assert.equal(normalizePhoneNumber('٠٩١٢٣٤٥٦٧٨٩'), '09123456789')
})

test('removes whitespace, parentheses and hyphens consistently', () => {
  assert.equal(normalizePhoneNumber('۰۹۱۲ ۱۲۳-۴۵۶۷'), '09121234567')
  assert.equal(normalizePhoneNumber('(0912) 123-4567'), '09121234567')
})

test('preserves an international plus prefix while normalizing digits', () => {
  assert.equal(normalizePhoneNumber('+۴۹ (۰) ۳۰-۱۲۳ ۴۵۶'), '+49030123456')
})

test('does not silently discard unsupported punctuation', () => {
  assert.equal(normalizePhoneNumber('0912.123.4567'), '0912.123.4567')
})
