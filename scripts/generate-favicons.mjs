import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
const source = 'public/images/shayan-emblem.webp'
const output = 'public/icons'
await mkdir(output, { recursive: true })
for (const size of [32, 180, 192, 512]) {
  await sharp(source).rotate().resize(size, size, { fit: 'contain', background: { r: 13, g: 12, b: 11, alpha: 1 } }).webp({ quality: 82, effort: 6 }).toFile(`${output}/shayan-${size}.webp`)
}
console.log('Generated optimized Shayan icons from the original emblem.')
