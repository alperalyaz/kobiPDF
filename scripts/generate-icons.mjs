// Generates app/installer icons and the in-app logo from resources/logo.svg.
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'resources/logo.svg')
const buildDir = resolve(root, 'build')
const rendererAssets = resolve(root, 'src/renderer/src/assets')
const SIZE = 1024

/** The SVG already has its rounded corners and transparent background. */
async function buildMasterIcon() {
  return sharp(source, { density: 300 }).resize(SIZE, SIZE).png().toBuffer()
}

/** A transparent square canvas with `image` centered at `scale` of its width. */
async function centered(image, size, scale) {
  const inner = Math.round(size * scale)
  const mark = await sharp(image).resize(inner, inner).png().toBuffer()
  const offset = Math.round((size - inner) / 2)
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toBuffer()
}

/**
 * Android launcher icons (Capacitor project in android/). Android 8+ uses the adaptive icon:
 * a white background (values/ic_launcher_background.xml) plus this foreground, where only the
 * middle 66 of 108 dp is safe from the launcher's mask. Older versions use the plain PNGs.
 */
async function buildAndroidIcons(master) {
  const res = resolve(root, 'android/app/src/main/res')
  if (!existsSync(res)) return
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }
  const roundMask = Buffer.from('<svg width="1024" height="1024"><circle cx="512" cy="512" r="512" fill="#fff"/></svg>')
  const roundMaster = await sharp(roundMask).composite([{ input: await centered(master, 1024, 0.78) }]).png().toBuffer()
  for (const [density, factor] of Object.entries(densities)) {
    const dir = resolve(res, `mipmap-${density}`)
    await mkdir(dir, { recursive: true })
    const legacy = Math.round(48 * factor)
    const adaptive = Math.round(108 * factor)
    await sharp(master).resize(legacy, legacy).png().toFile(resolve(dir, 'ic_launcher.png'))
    await sharp(roundMaster).resize(legacy, legacy).png().toFile(resolve(dir, 'ic_launcher_round.png'))
    await writeFile(resolve(dir, 'ic_launcher_foreground.png'), await centered(master, adaptive, 0.6))
  }
}

async function main() {
  await mkdir(buildDir, { recursive: true })
  await mkdir(rendererAssets, { recursive: true })

  const master = await buildMasterIcon()
  await writeFile(resolve(buildDir, 'icon.png'), master)

  const icoSizes = [16, 24, 32, 48, 64, 128, 256]
  const icoPngs = await Promise.all(
    icoSizes.map((s) => sharp(master).resize(s, s).png().toBuffer())
  )
  await writeFile(resolve(buildDir, 'icon.ico'), await pngToIco(icoPngs))

  await sharp(master).resize(256, 256).png().toFile(resolve(rendererAssets, 'logo.png'))

  // Microsoft Store (MSIX) tiles, picked up by electron-builder from build/appx.
  const appxDir = resolve(buildDir, 'appx')
  await mkdir(appxDir, { recursive: true })
  const square = { StoreLogo: 50, Square44x44Logo: 44, SmallTile: 71, Square150x150Logo: 150, LargeTile: 310 }
  for (const [name, size] of Object.entries(square)) {
    await sharp(master).resize(size, size).png().toFile(resolve(appxDir, `${name}.png`))
  }
  const wideMark = await sharp(master).resize(130, 130).png().toBuffer()
  await sharp({ create: { width: 310, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: wideMark, left: 90, top: 10 }])
    .png()
    .toFile(resolve(appxDir, 'Wide310x150Logo.png'))

  await buildAndroidIcons(master)

  console.log('Icons generated: build/icon.png, build/icon.ico, build/appx/*.png, android mipmaps, src/renderer/src/assets/logo.png')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
