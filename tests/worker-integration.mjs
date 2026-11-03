import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = process.cwd()
const runId = \`${process.pid}-${Date.now()}\`
const tempDirectory = await mkdtemp(join(tmpdir(), 'salon-booking-worker-'))
const configPath = join(root, \`.wrangler.integration-\${runId}.toml\`)
const persistPath = join(tempDirectory, 'd1-state')
const sessionSecret = 'local-worker-integration-secret-'.padEnd(64, 'x')
const baseHeaders = { 'cf-connecting-ip': '203.0.113.42' }
let workerProcess
let workerLogs = ''

const appendLogs = (chunk) => {
  workerLogs = (workerLogs + chunk.toString()).slice(-12_000)
}

const runWrangler = (args, timeoutMs = 120_000) => new Promise((resolvePromise, rejectPromise) => {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const child = spawn(executable, ['wrangler', ...args], {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  const timer = setTimeout(() => {
    child.kill('SIGTERM')
    rejectPromise(new Error(\`Wrangler command timed out: \${args.join(' ')}\\n\${stderr}\`))
  }, timeoutMs)
  child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
  child.once('error', (error) => {
    clearTimeout(timer)
    rejectPromise(error)
  })
  child.once('close', (code) => {
    clearTimeout(timer)
    if (code === 0) resolvePromise({ stdout, stderr })
    else rejectPromise(new Error(
      \`Wrangler command failed (\${code}): \${args.join(' ')}\\n\${stdout}\\n\${stderr}\`,
    ))
  })
})

const getFreePort = async () => {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not allocate a local test port')
  await new Promise((resolvePromise, rejectPromise) => server.close((error) => error ? rejectPromise(error) : resolvePromise()))
  return address.port
}

const expectJson = async (response, expectedStatus, label) => {
  const body = await response.json()
  assert.equal(
    response.status,
    expectedStatus,
    \`\${label}: expected HTTP \${expectedStatus}, received \${response.status}: \${JSON.stringify(body)}\`,
  )
  return body
}

const request = (baseUrl, path, options = {}) => {
  const headers = new Headers({ ...baseHeaders, ...(options.headers ?? {}) })
  if (options.body !== undefined) headers.set('content-type', 'application/json')
  return fetch(new URL(path, baseUrl), { ...options, headers })
}

const waitForWorker = async (baseUrl) => {
  const deadline = Date.now() + 90_000
  let lastError = ''
  while (Date.now() < deadline) {
    if (workerProcess.exitCode !== null || workerProcess.signalCode !== null) {
      throw new Error(\`Wrangler exited before becoming ready.\\n\${workerLogs}\`)
    }
    try {
      const response = await fetch(new URL('/api/health', baseUrl), { signal: AbortSignal.timeout(1500) })
      if (response.ok) return
      lastError = \`health endpoint returned \${response.status}\`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 400))
  }
  throw new Error(\`Worker did not become ready: \${lastError}\\n\${workerLogs}\`)
}

const sqlQuote = (value) => \`'\${String(value).replaceAll("'", "''")}'\`

try {
  const originalConfig = await readFile(join(root, 'wrangler.toml'), 'utf8')
  const testConfig = originalConfig.replace(
    /database_id\\s*=\\s*"[^"]+"/,
    'database_id = "00000000-0000-4000-8000-000000000001"',
  )
  assert.notEqual(testConfig, originalConfig, 'wrangler.toml must contain a D1 database_id')
  await writeFile(configPath, testConfig, 'utf8')

  console.log('Applying all D1 migrations to an isolated local database...')
  await runWrangler([
    'd1', 'migrations', 'apply', 'salon-booking',
    '--local', '--persist-to', persistPath, '--config', configPath,
  ])

  const bookingDate = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)
  const date = [
    String(bookingDate.getUTCFullYear()).padStart(4, '0'),
    String(bookingDate.getUTCMonth() + 1).padStart(2, '0'),
    String(bookingDate.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const weekday = bookingDate.getUTCDay()
  const seedSql = [
    \`INSERT INTO services (id, name, description, duration_minutes, price_amount, price_currency, is_active, sort_order) VALUES ('integration-service', 'Integration service', '', 30, 10000, 'IRR', 1, 0)\`,
    \`UPDATE salon_settings SET setting_value = 'UTC' WHERE setting_key = 'local_timezone'\`,
    \`UPDATE salon_settings SET setting_value = '0' WHERE setting_key = 'min_booking_notice_minutes'\`,
    \`UPDATE salon_settings SET setting_value = '30' WHERE setting_key = 'booking_window_days'\`,
    \`UPDATE salon_settings SET setting_value = '30' WHERE setting_key = 'slot_interval_minutes'\`,
    \`UPDATE salon_settings SET setting_value = '0' WHERE setting_key = 'buffer_minutes'\`,
    \`INSERT INTO opening_hours (id, weekday, opens_at, closes_at, is_closed) VALUES ('integration-hours', \${weekday}, '09:00', '17:00', 0)\`,
  ].join(';\\n')
  await runWrangler([
    'd1', 'execute', 'salon-booking', '--local', '--persist-to', persistPath,
    '--config', configPath, '--command', seedSql,
  ])

  const port = await getFreePort()
  const baseUrl = \`http://127.0.0.1:\${port}\`
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  workerProcess = spawn(executable, [
    'wrangler', 'dev', '--config', configPath, '--ip', '127.0.0.1',
    '--port', String(port), '--persist-to', persistPath,
    '--var', \`SESSION_SECRET:\${sessionSecret}\`,
  ], {
    cwd: root,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  workerProcess.stdout.on('data', appendLogs)
  workerProcess.stderr.on('data', appendLogs)

  await waitForWorker(baseUrl)
  console.log('Worker is running. Exercising public booking and customer-management routes...')

  const health = await expectJson(await request(baseUrl, '/api/health'), 200, 'health')
  assert.equal(health.service, 'salon-booking-api')

  const config = await expectJson(await request(baseUrl, '/api/public/config'), 200, 'public config')
  assert.equal(config.configured, true)
  assert.equal(config.timezone, 'UTC')

  const services = await expectJson(await request(baseUrl, '/api/public/services'), 200, 'public services')
  assert.equal(services.services.length, 1)
  assert.equal(services.services[0].id, 'integration-service')

  const availabilityPath = \`/api/public/availability?date=\${date}&serviceId=integration-service\`
  const availability = await expectJson(await request(baseUrl, availabilityPath), 200, 'availability')
  assert.ok(availability.slots.includes('09:00'), 'first valid local opening slot should be returned')

  const bookingInput = {
    serviceId: 'integration-service',
    date,
    time: '09:00',
    name: 'Integration Client',
    phone: '+491234567890',
    note: 'Automated integration fixture',
  }
  const created = await expectJson(await request(baseUrl, '/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingInput),
  }), 201, 'create booking')

  const booking = created.booking
  assert.match(booking.reference, /^SB-[A-HJ-NP-Z2-9]{7}$/)
  assert.match(booking.managementToken, /^[0-9a-f]{64}$/i, 'management token must contain 256 bits')
  assert.equal(booking.status, 'pending')

  const conflict = await expectJson(await request(baseUrl, '/api/public/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingInput),
  }), 409, 'duplicate booking')
  assert.equal(conflict.error, 'slot_unavailable')

  const origin = new URL(baseUrl).origin
  const managementHeaders = { origin }
  const crossOrigin = await expectJson(await request(baseUrl, '/api/public/bookings/lookup', {
    method: 'POST',
    headers: { origin: 'https://attacker.invalid' },
    body: JSON.stringify({ reference: booking.reference, managementToken: booking.managementToken }),
  }), 403, 'cross-origin lookup')
  assert.equal(crossOrigin.error, 'forbidden_origin')

  const invalidCredential = await expectJson(await request(baseUrl, '/api/public/bookings/lookup', {
    method: 'POST',
    headers: managementHeaders,
    body: JSON.stringify({ reference: booking.reference, managementToken: '0'.repeat(64) }),
  }), 404, 'invalid management token')
  assert.equal(invalidCredential.error, 'booking_access_invalid')

  const lookup = await expectJson(await request(baseUrl, '/api/public/bookings/lookup', {
    method: 'POST',
    headers: managementHeaders,
    body: JSON.stringify({ reference: booking.reference, managementToken: booking.managementToken }),
  }), 200, 'customer lookup')
  assert.equal(lookup.booking.reference, booking.reference)
  assert.equal(lookup.booking.serviceName, 'Integration service')
  assert.equal(lookup.booking.durationMinutes, 30)
  assert.equal(lookup.booking.status, 'pending')
  for (const privateField of ['name', 'phone', 'note', 'clientName', 'clientPhone', 'clientNote']) {
    assert.equal(Object.hasOwn(lookup.booking, privateField), false, \`customer lookup must not expose \${privateField}\`)
  }

  const cancelled = await expectJson(await request(baseUrl, '/api/public/bookings/cancel', {
    method: 'POST',
    headers: managementHeaders,
    body: JSON.stringify({ reference: booking.reference, managementToken: booking.managementToken }),
  }), 200, 'customer cancellation')
  assert.equal(cancelled.booking.status, 'cancelled')

  const repeatedCancel = await expectJson(await request(baseUrl, '/api/public/bookings/cancel', {
    method: 'POST',
    headers: managementHeaders,
    body: JSON.stringify({ reference: booking.reference, managementToken: booking.managementToken }),
  }), 200, 'idempotent cancellation')
  assert.equal(repeatedCancel.alreadyCancelled, true)

  const reopenedAvailability = await expectJson(
    await request(baseUrl, availabilityPath),
    200,
    'availability after cancellation',
  )
  assert.ok(
    reopenedAvailability.slots.includes('09:00'),
    'cancelling a booking should release its slot',
  )

  console.log('PASS: local Worker + D1 migrations, availability, booking creation, duplicate protection, origin/token checks, privacy-safe lookup, cancellation and slot release.')
} catch (error) {
  console.error(error)
  if (workerLogs) console.error(workerLogs)
  process.exitCode = 1
} finally {
  if (workerProcess && workerProcess.exitCode === null && workerProcess.signalCode === null) {
    const exited = once(workerProcess, 'exit')
    workerProcess.kill('SIGTERM')
    await Promise.race([
      exited,
      new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000)),
    ])
    if (workerProcess.exitCode === null && workerProcess.signalCode === null) {
      workerProcess.kill('SIGKILL')
    }
  }
  await rm(configPath, { force: true })
  await rm(tempDirectory, { recursive: true, force: true })
}
