import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8')

test('archived local Worker config remains isolated from production D1', async () => {
  const config = await read('wrangler.dev.toml.example')
  assert.match(config, /^name = "salon-booking-local"$/m)
  assert.match(config, /^database_name = "salon-booking"$/m)
  assert.match(config, /^database_id = "00000000-0000-4000-8000-000000000001"$/m)
  assert.match(config, /^migrations_dir = "migrations"$/m)
  assert.doesNotMatch(config, /REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID/)
})

test('Cloudflare commands are not part of the active package scripts', async () => {
  const pkg = JSON.parse(await read('package.json'))
  assert.equal(pkg.scripts['db:local'], undefined)
  assert.equal(pkg.scripts['db:remote'], undefined)
  assert.equal(pkg.scripts['dev:worker'], undefined)
  assert.equal(pkg.scripts.deploy, undefined)
  assert.equal(pkg.scripts['test:worker'], undefined)
  assert.equal(pkg.devDependencies.wrangler, undefined)
  assert.equal(pkg.devDependencies['@cloudflare/workers-types'], undefined)
})

test('archived production Wrangler config retains the previous D1 identity for recovery only', async () => {
  const config = await read('wrangler.toml')
  assert.match(config, /^name = "salon-booking"$/m)
  assert.match(config, /^database_name = "salon-booking"$/m)
  assert.match(config, /^database_id = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"$/m)
  assert.doesNotMatch(config, /REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID/)
  assert.doesNotMatch(config, /00000000-0000-4000-8000-000000000001/)
})

test('legacy local-only secrets and config files remain ignored by Git', async () => {
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
