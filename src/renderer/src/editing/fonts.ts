import { useEffect, useState } from 'react'
import sansRegular from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url'
import sansBold from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url'
import sansItalic from 'dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf?url'
import sansBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf?url'
import serifRegular from 'dejavu-fonts-ttf/ttf/DejaVuSerif.ttf?url'
import serifBold from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Bold.ttf?url'
import serifItalic from 'dejavu-fonts-ttf/ttf/DejaVuSerif-Italic.ttf?url'
import serifBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSerif-BoldItalic.ttf?url'
import monoRegular from 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url'
import monoBold from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Bold.ttf?url'
import monoItalic from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-Oblique.ttf?url'
import monoBoldItalic from 'dejavu-fonts-ttf/ttf/DejaVuSansMono-BoldOblique.ttf?url'
import arimoRegular from '@expo-google-fonts/arimo/400Regular/Arimo_400Regular.ttf?url'
import arimoBold from '@expo-google-fonts/arimo/700Bold/Arimo_700Bold.ttf?url'
import arimoItalic from '@expo-google-fonts/arimo/400Regular_Italic/Arimo_400Regular_Italic.ttf?url'
import arimoBoldItalic from '@expo-google-fonts/arimo/700Bold_Italic/Arimo_700Bold_Italic.ttf?url'
import tinosRegular from '@expo-google-fonts/tinos/400Regular/Tinos_400Regular.ttf?url'
import tinosBold from '@expo-google-fonts/tinos/700Bold/Tinos_700Bold.ttf?url'
import tinosItalic from '@expo-google-fonts/tinos/400Regular_Italic/Tinos_400Regular_Italic.ttf?url'
import tinosBoldItalic from '@expo-google-fonts/tinos/700Bold_Italic/Tinos_700Bold_Italic.ttf?url'
import cousineRegular from '@expo-google-fonts/cousine/400Regular/Cousine_400Regular.ttf?url'
import cousineBold from '@expo-google-fonts/cousine/700Bold/Cousine_700Bold.ttf?url'
import cousineItalic from '@expo-google-fonts/cousine/400Regular_Italic/Cousine_400Regular_Italic.ttf?url'
import cousineBoldItalic from '@expo-google-fonts/cousine/700Bold_Italic/Cousine_700Bold_Italic.ttf?url'
import carlitoRegular from '@expo-google-fonts/carlito/400Regular/Carlito_400Regular.ttf?url'
import carlitoBold from '@expo-google-fonts/carlito/700Bold/Carlito_700Bold.ttf?url'
import carlitoItalic from '@expo-google-fonts/carlito/400Regular_Italic/Carlito_400Regular_Italic.ttf?url'
import carlitoBoldItalic from '@expo-google-fonts/carlito/700Bold_Italic/Carlito_700Bold_Italic.ttf?url'
import gelasioRegular from '@expo-google-fonts/gelasio/400Regular/Gelasio_400Regular.ttf?url'
import gelasioBold from '@expo-google-fonts/gelasio/700Bold/Gelasio_700Bold.ttf?url'
import gelasioItalic from '@expo-google-fonts/gelasio/400Regular_Italic/Gelasio_400Regular_Italic.ttf?url'
import gelasioBoldItalic from '@expo-google-fonts/gelasio/700Bold_Italic/Gelasio_700Bold_Italic.ttf?url'
import { SYSTEM_FONT_IDS, type SystemFontId } from '../../../shared/ipc'
import { LINE_HEIGHT, type FontFamily, type TextStyle } from './types'

type Files = [string, string, string, string]

/** [regular, bold, italic, bold italic] */
const BUNDLED_FILES: Record<'sans' | 'serif' | 'mono', Files> = {
  sans: [sansRegular, sansBold, sansItalic, sansBoldItalic],
  serif: [serifRegular, serifBold, serifItalic, serifBoldItalic],
  mono: [monoRegular, monoBold, monoItalic, monoBoldItalic]
}

/**
 * Free fonts with exactly the same character widths as a common Windows font (measured: 0.000 %
 * difference on Turkish text). They stand in where the real font is missing (always on Android), so
 * corrected text keeps the original line length. Licensed under the SIL OFL 1.1.
 */
type TwinId = 'arial' | 'times' | 'courier' | 'calibri' | 'georgia'
const TWINS: Record<TwinId, { label: string; files: Files; ascent: number; descent: number }> = {
  arial: { label: 'Arimo', files: [arimoRegular, arimoBold, arimoItalic, arimoBoldItalic], ascent: 0.905, descent: 0.212 },
  times: { label: 'Tinos', files: [tinosRegular, tinosBold, tinosItalic, tinosBoldItalic], ascent: 0.891, descent: 0.216 },
  courier: {
    label: 'Cousine',
    files: [cousineRegular, cousineBold, cousineItalic, cousineBoldItalic],
    ascent: 0.833,
    descent: 0.3
  },
  calibri: {
    label: 'Carlito',
    files: [carlitoRegular, carlitoBold, carlitoItalic, carlitoBoldItalic],
    ascent: 0.952,
    descent: 0.269
  },
  georgia: {
    label: 'Gelasio',
    files: [gelasioRegular, gelasioBold, gelasioItalic, gelasioBoldItalic],
    ascent: 0.928,
    descent: 0.342
  }
}

function twinOf(font: FontFamily): (typeof TWINS)[TwinId] | undefined {
  return (TWINS as Partial<Record<FontFamily, (typeof TWINS)[TwinId]>>)[font]
}

/** True when `font` is drawn with its stand-in, not the real system font. */
function usesTwin(font: FontFamily): boolean {
  return !isBundled(font) && !installedSystemFonts.includes(font) && twinOf(font) !== undefined
}

/** Ascent and descent (em fractions) of the face actually drawn, for placing the baseline. */
const SYSTEM_METRICS: Partial<Record<FontFamily, { ascent: number; descent: number }>> = {
  sans: { ascent: 0.928, descent: 0.236 },
  mono: { ascent: 0.928, descent: 0.236 },
  serif: { ascent: 0.939, descent: 0.236 },
  times: { ascent: 0.891, descent: 0.216 },
  courier: { ascent: 0.833, descent: 0.3 },
  calibri: { ascent: 0.75, descent: 0.25 },
  georgia: { ascent: 0.917, descent: 0.219 },
  tahoma: { ascent: 1.0, descent: 0.207 },
  verdana: { ascent: 1.005, descent: 0.21 }
}

export function faceMetrics(font: FontFamily): { ascent: number; descent: number } {
  const twin = usesTwin(font) ? twinOf(font) : undefined
  if (twin) return { ascent: twin.ascent, descent: twin.descent }
  return SYSTEM_METRICS[font] ?? { ascent: 0.905, descent: 0.212 }
}

/** The bundled face used when `font` lacks a character (saving) or cannot be loaded. */
export function fallbackFamily(font: FontFamily): 'sans' | 'serif' | 'mono' | null {
  return isBundled(font) ? null : FALLBACK_FAMILY[font]
}

/** Resolves once the face for `style` is loaded, so measuring with it is exact. */
export function whenFontReady(style: TextStyle): Promise<void> {
  return document.fonts
    .load(cssFont(style, 16))
    .then(() => undefined)
    .catch(() => undefined)
}

const BUNDLED_LABELS: Record<'sans' | 'serif' | 'mono', string> = {
  sans: 'DejaVu Sans',
  serif: 'DejaVu Serif',
  mono: 'DejaVu Sans Mono'
}

const SYSTEM_LABELS: Record<SystemFontId, string> = {
  arial: 'Arial',
  times: 'Times New Roman',
  calibri: 'Calibri',
  georgia: 'Georgia',
  verdana: 'Verdana',
  courier: 'Courier New',
  trebuchet: 'Trebuchet MS',
  segoe: 'Segoe UI',
  consolas: 'Consolas',
  palatino: 'Palatino Linotype',
  candara: 'Candara',
  constantia: 'Constantia',
  corbel: 'Corbel',
  tahoma: 'Tahoma'
}

/** Used when a chosen system font cannot be read, so save still embeds a face. */
const FALLBACK_FAMILY: Record<SystemFontId, 'sans' | 'serif' | 'mono'> = {
  arial: 'sans',
  calibri: 'sans',
  verdana: 'sans',
  trebuchet: 'sans',
  segoe: 'sans',
  candara: 'sans',
  corbel: 'sans',
  times: 'serif',
  georgia: 'serif',
  palatino: 'serif',
  constantia: 'serif',
  courier: 'mono',
  consolas: 'mono',
  tahoma: 'sans'
}

/** The font itself when it is installed here or has a stand-in, otherwise the closest bundled face. */
export function usableFont(font: FontFamily): FontFamily {
  if (isBundled(font) || installedSystemFonts.includes(font) || twinOf(font)) return font
  return FALLBACK_FAMILY[font]
}

export function fontLabel(font: FontFamily): string {
  if (font === 'sans' || font === 'serif' || font === 'mono') return BUNDLED_LABELS[font]
  const twin = usesTwin(font) ? twinOf(font) : undefined
  return twin ? `${SYSTEM_LABELS[font]} (${twin.label})` : SYSTEM_LABELS[font]
}

let installedSystemFonts: SystemFontId[] = []

/** System fonts that can be drawn here: installed, or standing in through a twin. */
function availableSystemFonts(): Set<SystemFontId> {
  return new Set<SystemFontId>([...installedSystemFonts, ...(Object.keys(TWINS) as TwinId[])])
}

/** Bundled faces first, then the system faces that can be drawn here. */
export function fontChoices(): { id: FontFamily; label: string }[] {
  const available = availableSystemFonts()
  return [
    ...(Object.keys(BUNDLED_LABELS) as ('sans' | 'serif' | 'mono')[]).map((id) => ({
      id,
      label: BUNDLED_LABELS[id]
    })),
    ...SYSTEM_FONT_IDS.filter((id) => available.has(id)).map((id) => ({ id, label: fontLabel(id) }))
  ]
}

/** The same files are used on screen and embedded on save, so wrapping matches. */
export function cssFontFamily(font: FontFamily): string {
  return `"kobiPDF ${font}"`
}

function variantOf(style: Pick<TextStyle, 'bold' | 'italic'>): 0 | 1 | 2 | 3 {
  return ((style.bold ? 1 : 0) + (style.italic ? 2 : 0)) as 0 | 1 | 2 | 3
}

function isBundled(font: FontFamily): font is 'sans' | 'serif' | 'mono' {
  return font === 'sans' || font === 'serif' || font === 'mono'
}

export function cssFont(style: TextStyle, size: number): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${size}px ${cssFontFamily(style.font)}`
}

let fontsVersion = 0
const listeners = new Set<() => void>()

function notifyFonts(): void {
  fontsVersion += 1
  listeners.forEach((listener) => listener())
}

/** `source` is the font bytes, or a CSS url() so the browser loads the file without a JS copy. */
async function loadFace(
  family: FontFamily,
  source: ArrayBuffer | string,
  style: Pick<TextStyle, 'bold' | 'italic'>
): Promise<void> {
  const face = new FontFace(`kobiPDF ${family}`, typeof source === 'string' ? `url("${source}")` : source, {
    weight: style.bold ? '700' : '400',
    style: style.italic ? 'italic' : 'normal'
  })
  document.fonts.add(face)
  await face.load()
}

const VARIANTS = [
  { bold: false, italic: false },
  { bold: true, italic: false },
  { bold: false, italic: true },
  { bold: true, italic: true }
]

export function registerFonts(): void {
  const faces: Promise<unknown>[] = []
  for (const font of Object.keys(BUNDLED_FILES) as ('sans' | 'serif' | 'mono')[]) {
    for (const style of VARIANTS) faces.push(loadFace(font, BUNDLED_FILES[font][variantOf(style)], style))
  }
  void Promise.allSettled(faces).then(() => notifyFonts())

  void window.api
    .listSystemFonts()
    .catch(() => [] as SystemFontId[])
    .then(async (ids) => {
      const known = new Set<string>(SYSTEM_FONT_IDS)
      installedSystemFonts = ids.filter((id): id is SystemFontId => known.has(id))
      // One source per family: the real font when installed, else its twin; never both.
      const loads: Promise<unknown>[] = []
      for (const font of availableSystemFonts()) {
        const twin = usesTwin(font) ? twinOf(font) : undefined
        for (const style of VARIANTS) {
          loads.push(
            twin
              ? loadFace(font, twin.files[variantOf(style)], style)
              : getFontBytes({ font, ...style }).then((bytes) => loadFace(font, bytes, style))
          )
        }
      }
      await Promise.allSettled(loads)
      notifyFonts()
    })
}

/** Re-renders once the embedded fonts finish loading, so text is re-measured. */
export function useFontsVersion(): number {
  const [version, setVersion] = useState(fontsVersion)
  useEffect(() => {
    const listener = (): void => setVersion(fontsVersion)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return version
}

const fontBytesCache = new Map<string, Promise<ArrayBuffer>>()

function cacheKey(font: FontFamily, style: Pick<TextStyle, 'bold' | 'italic'>): string {
  return `${font}:${variantOf(style)}`
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

export function getFontBytes(style: Pick<TextStyle, 'font' | 'bold' | 'italic'>): Promise<ArrayBuffer> {
  const key = cacheKey(style.font, style)
  const cached = fontBytesCache.get(key)
  if (cached) return cached
  const fetchFile = (url: string, label: string): Promise<ArrayBuffer> =>
    fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Font load failed: ${label}`)
      return response.arrayBuffer()
    })
  let bytes: Promise<ArrayBuffer>
  if (isBundled(style.font)) {
    bytes = fetchFile(BUNDLED_FILES[style.font][variantOf(style)], style.font)
  } else {
    const font = style.font
    const twin = twinOf(font)
    // The real file, else the twin, else the closest bundled face.
    const substitute = (): Promise<ArrayBuffer> =>
      twin
        ? fetchFile(twin.files[variantOf(style)], twin.label)
        : getFontBytes({ ...style, font: FALLBACK_FAMILY[font] })
    bytes = window.api
      .readSystemFont(font, variantOf(style))
      .then((data) => (data && data.byteLength > 0 ? toArrayBuffer(data) : substitute()))
      .catch(() => substitute())
  }
  fontBytesCache.set(key, bytes)
  return bytes
}

let measureCtx: CanvasRenderingContext2D | null = null

export function measureText(text: string, style: TextStyle): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
    // The saved PDF draws without kerning (pdf-lib); measure the same way so lines match.
    if (measureCtx) measureCtx.fontKerning = 'none'
  }
  if (!measureCtx) return text.length * style.size * 0.55
  measureCtx.font = cssFont(style, style.size)
  return measureCtx.measureText(text).width
}

const measure = measureText

/** Greedy word wrap shared by the on-screen view and the PDF export. */
export function layoutLines(text: string, style: TextStyle, width: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.replace(/\t/g, '    ').split('\n')) {
    if (paragraph === '') {
      lines.push('')
      continue
    }
    let line = ''
    // A single word wider than the box is broken by characters.
    const breakLongLine = (): void => {
      while (measure(line.trimEnd(), style) > width && line.trim().length > 1) {
        let cut = line.length - 1
        while (cut > 1 && measure(line.slice(0, cut), style) > width) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    for (const token of paragraph.split(/(\s+)/).filter((t) => t !== '')) {
      const candidate = line + token
      if (line === '' || measure(candidate.trimEnd(), style) <= width) {
        line = candidate
      } else {
        lines.push(line.trimEnd())
        line = /^\s+$/.test(token) ? '' : token
      }
      breakLongLine()
    }
    lines.push(line.trimEnd())
  }
  return lines
}

export function lineHeight(style: TextStyle): number {
  return style.size * LINE_HEIGHT
}

export function textBlockHeight(text: string, style: TextStyle, width: number): number {
  return Math.max(1, layoutLines(text, style, width).length) * lineHeight(style)
}
