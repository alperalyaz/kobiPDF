// Generates app/installer icons and the in-app logo from resources/logo.svg.
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

  console.log('Icons generated: build/icon.png, build/icon.ico, src/renderer/src/assets/logo.png')
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
