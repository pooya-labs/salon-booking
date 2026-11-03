import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8')

test('local Worker config uses an isolated local D1 placeholder', async () => {
  const config = await read('wrangler.dev.toml.example')
  assert.match(config, /^name = "salon-booking-local"$/m)
  assert.match(config, /^database_name = "salon-booking"$/m)
  assert.match(config, /^database_id = "00000000-0000-4000-8000-000000000001"$/m)
  assert.match(config, /^migrations_dir = "migrations"$/m)
  assert.doesNotMatch(config, /REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID/)
})

test('local scripts explicitly use the local Wrangler config and local D1', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.match(pkg.scripts['db:local'], /wrangler d1 migrations apply salon-booking --local --config wrangler.dev.toml/)
  assert.match(pkg.scripts['dev:worker'], /wrangler dev --config wrangler.dev.toml/)
  assert.match(pkg.scripts.deploy, /wrangler deploy/)
  assert.doesNotMatch(pkg.scripts.deploy, /wrangler.dev.toml/)
})

test('production Wrangler config remains separate and unmodified by local setup', async () => {
  const config = await read('wrangler.toml')
  assert.match(config, /^name = "salon-booking"$/m)
  assert.match(config, /^database_id = "REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID"$/m)
  assert.doesNotMatch(config, /00000000-0000-4000-8000-000000000001/)
})

test('local-only secrets and config files are ignored by Git', async () => {
  const ignore = await read('.gitignore')
  assert.match(ignore, /^\.dev\.vars$/m)
  assert.match(ignore, /^wrangler\.dev\.toml$/m)
  const example = await read('.dev.vars.example')
  const entries = Object.fromEntries(
    example.split('\n')
      .filter(line => /^[A-Z_]+=/.test(line))
      .map(line => line.split('=', 2)),
  )
  assert.ok(entries.SESSION_SECRET)
  assert.ok(entries.ADMIN_BOOTSTRAP_TOKEN)
  assert.notEqual(entries.SESSION_SECRET, entries.ADMIN_BOOTSTRAP_TOKEN)
})
