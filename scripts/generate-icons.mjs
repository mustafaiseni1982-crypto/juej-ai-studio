/**
 * Gjeneron PNG për iPhone / PWA nga public/favicon.svg
 * Ekzekuto: node scripts/generate-icons.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = join(root, 'public', 'favicon.svg')
const svg = readFileSync(svgPath)

const out = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]

for (const [name, size] of out) {
  await sharp(svg).resize(size, size).png().toFile(join(root, 'public', name))
  console.log('Wrote', name, size)
}
