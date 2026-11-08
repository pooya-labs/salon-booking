import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const read = (path) => readFile(new URL('../' + path, import.meta.url))

const heroPath = 'public/images/shayan-hero.webp'
const emblemPath = 'public/images/shayan-emblem.webp'

test('owner-supplied Shayan hero and emblem are valid local WebP assets', async () => {
  for (const path of [heroPath, emblemPath]) {
    const asset = await read(path)
    assert.ok(asset.byteLength > 10_000, path + ' should not be an empty or placeholder file')
    assert.equal(asset.toString('ascii', 0, 4), 'RIFF', path + ' must use the RIFF container')
    assert.equal(asset.toString('ascii', 8, 12), 'WEBP', path + ' must be a WebP image')
  }
})

test('Shayan hero illustration is used in the public hero and emblem is used for brand marks', async () => {
  const [app, admin, html, manifest, iconSvg, pushClient] = await Promise.all([
    read('src/App.tsx'),
    read('src/Admin.tsx'),
    read('index.html'),
    read('public/manifest.webmanifest'),
    read('public/icons/salon-icon.svg'),
    read('src/push-notifications.ts'),
  ])
  const sources = [app, admin, html, manifest, iconSvg, pushClient].map(value => value.toString('utf8'))
  const allSources = sources.join('\n')

  assert.match(app.toString('utf8'), /images\/shayan-hero\.webp/)
  assert.match(app.toString('utf8'), /images\/shayan-emblem\.webp/)
  assert.match(admin.toString('utf8'), /images\/shayan-emblem\.webp/)
  assert.match(html.toString('utf8'), /icons\/shayan-32\.webp\?v=3/)
  assert.match(html.toString('utf8'), /icons\/shayan-180\.webp\?v=3/)
  assert.match(manifest.toString('utf8'), /icons\/shayan-192\.webp/)
  assert.match(manifest.toString('utf8'), /icons\/shayan-512\.webp/)
  assert.match(html.toString('utf8'), /rel="apple-touch-icon"/)
  assert.match(iconSvg.toString('utf8'), /\.\.\/images\/shayan-emblem\.webp/)
  assert.match(pushClient.toString('utf8'), /اعلان جدید شایان/)
  assert.doesNotMatch(allSources, /shayan-barber-logo\.webp/, 'legacy logo must not be wired into the UI')
})
