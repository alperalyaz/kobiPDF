// Google Play graphics: 512x512 app icon and the 1024x500 feature graphic (no alpha, as Play requires).
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'docs/store/play')
const logo = resolve(root, 'resources/logo.svg')
const NAVY = '#1f2b45'
const RED = '#d7141a'

await mkdir(out, { recursive: true })

// Icon: the logo on white, full bleed (Play adds its own rounded mask).
const mark = await sharp(logo, { density: 300 }).resize(430, 430).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 3, background: '#ffffff' } })
  .composite([{ input: mark, left: 41, top: 41 }])
  .flatten({ background: '#ffffff' })
  .removeAlpha()
  .png()
  .toFile(resolve(out, 'icon-512.png'))

// Feature graphic: navy band, logo tile on the left, name and one line of text.
const tile = await sharp({ create: { width: 300, height: 300, channels: 4, background: '#ffffff' } })
  .composite([{ input: await sharp(logo, { density: 300 }).resize(250, 250).png().toBuffer(), left: 25, top: 25 }])
  .png()
  .toBuffer()
const rounded = await sharp(tile)
  .composite([{ input: Buffer.from('<svg width="300" height="300"><rect width="300" height="300" rx="56" fill="#fff"/></svg>'), blend: 'dest-in' }])
  .png()
  .toBuffer()
const text = Buffer.from(`<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <text x="420" y="225" font-family="Arial, Helvetica, sans-serif" font-size="96" font-weight="700" fill="#ffffff">kobi<tspan fill="${RED}">PDF</tspan></text>
  <text x="424" y="295" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="#e8ebf2">PDF açın, düzeltin, imzalayın</text>
  <rect x="424" y="330" width="120" height="8" rx="4" fill="${RED}"/>
</svg>`)
await sharp({ create: { width: 1024, height: 500, channels: 3, background: NAVY } })
  .composite([
    { input: rounded, left: 70, top: 100 },
    { input: text, left: 0, top: 0 }
  ])
  .flatten({ background: NAVY })
  .removeAlpha()
  .png()
  .toFile(resolve(out, 'feature-1024x500.png'))

console.log('Play graphics: docs/store/play/icon-512.png, feature-1024x500.png')
