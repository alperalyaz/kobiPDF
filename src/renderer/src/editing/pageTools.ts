import { useAppStore, type PageSize, type ToolId } from '../store/useAppStore'
import { useEditStore } from '../store/useEditStore'
import { commitDraft, nextDraftToken } from './draft'
import { measureText, usableFont } from './fonts'
import { fontAt } from './pdfFonts'
import { boundsOfPoints, clientToPage, rgbToHex } from './geometry'
import { changeObjects } from './history'
import { newId, type FontFamily, type MarkupObject, type MarkupType, type Rect } from './types'

export const MARKUP_TOOLS: Partial<Record<ToolId, MarkupType>> = {
  underline: 'underline',
  strikeout: 'strikeout'
}

/** Page wrapper element (`[data-page]`) for a viewer page. */
export function pageWrapper(pageNumber: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-viewer] [data-page="${pageNumber}"]`)
}

/** Maps a client rectangle into the page frame (bounding box of its four corners). */
export function clientRectToPage(rect: DOMRect, wrapper: DOMRect, size: PageSize, zoom: number): Rect {
  const corners = [
    [rect.left, rect.top],
    [rect.right, rect.top],
    [rect.left, rect.bottom],
    [rect.right, rect.bottom]
  ].map(([x, y]) => clientToPage(x, y, wrapper, size, zoom))
  return boundsOfPoints(corners)
}

/** Merges rects on the same line that touch or overlap, so a selection becomes one bar per line. */
export function mergeLineRects(rects: Rect[]): Rect[] {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x)
  const result: Rect[] = []
  for (const r of sorted) {
    const last = result.find((m) => {
      const overlap = Math.min(m.y + m.height, r.y + r.height) - Math.max(m.y, r.y)
      const sameLine = overlap > Math.min(m.height, r.height) * 0.5
      const gap = Math.max(m.x, r.x) - Math.min(m.x + m.width, r.x + r.width)
      return sameLine && gap < Math.max(2, Math.min(m.height, r.height) * 0.6)
    })
    if (!last) {
      result.push({ ...r })
      continue
    }
    const x = Math.min(last.x, r.x)
    const y = Math.min(last.y, r.y)
    last.width = Math.max(last.x + last.width, r.x + r.width) - x
    last.height = Math.max(last.y + last.height, r.y + r.height) - y
    last.x = x
    last.y = y
  }
  return result
}

/** Creates markup objects from the current text selection. Returns true when something was added. */
export function markupFromSelection(type: MarkupType): boolean {
  const selection = window.getSelection()
  const doc = useAppStore.getState().document
  if (!selection || selection.isCollapsed || selection.rangeCount === 0 || !doc) return false
  const { zoom } = useAppStore.getState()
  const wrappers = [...document.querySelectorAll<HTMLElement>('[data-viewer] [data-page]')]
  const byPage = new Map<number, Rect[]>()

  for (let i = 0; i < selection.rangeCount; i++) {
    for (const rect of selection.getRangeAt(i).getClientRects()) {
      if (rect.width < 1 || rect.height < 1) continue
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      for (const wrapper of wrappers) {
        const box = wrapper.getBoundingClientRect()
        if (cx < box.left || cx > box.right || cy < box.top || cy > box.bottom) continue
        const pageIndex = Number(wrapper.dataset.page) - 1
        const size = doc.pageSizes[pageIndex]
        const pageRect = clientRectToPage(rect, box, size, zoom)
        // Skip whole-layer rects (e.g. the end-of-content element).
        if (pageRect.height > size.baseHeight * 0.5) break
        byPage.set(pageIndex, [...(byPage.get(pageIndex) ?? []), pageRect])
        break
      }
    }
  }
  if (byPage.size === 0) return false

  const style = useEditStore.getState().settings.markup[type]
  const created: MarkupObject[] = [...byPage].map(([pageIndex, rects]) => ({
    id: newId(),
    kind: 'markup',
    pageIndex,
    type,
    rects: mergeLineRects(rects),
    color: style.color,
    opacity: style.opacity,
    strokeWidth: type === 'highlight' ? undefined : style.width
  }))
  changeObjects((objects) => [...objects, ...created])
  selection.removeAllRanges()
  return true
}

function sampleCanvas(canvas: HTMLCanvasElement, clientX: number, clientY: number): [number, number, number] | null {
  const rect = canvas.getBoundingClientRect()
  const x = Math.round(((clientX - rect.left) / rect.width) * canvas.width)
  const y = Math.round(((clientY - rect.top) / rect.height) * canvas.height)
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return null
  const data = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(x, y, 1, 1).data
  return data ? [data[0], data[1], data[2]] : null
}

const luminance = ([r, g, b]: [number, number, number]): number => 0.299 * r + 0.587 * g + 0.114 * b

/** Background color around a client rect: the most common color on a ring just outside it. */
function backgroundAround(canvas: HTMLCanvasElement, r: DOMRect): string {
  const samples: [number, number, number][] = []
  const pad = 2
  for (let i = 0; i <= 6; i++) {
    const fx = r.left + (r.width * i) / 6
    const fy = r.top + (r.height * i) / 6
    for (const [x, y] of [
      [fx, r.top - pad],
      [fx, r.bottom + pad],
      [r.left - pad, fy],
      [r.right + pad, fy]
    ]) {
      const s = sampleCanvas(canvas, x, y)
      if (s) samples.push(s)
    }
  }
  if (samples.length === 0) return '#ffffff'
  const counts = new Map<string, number>()
  for (const [red, green, blue] of samples) {
    const key = rgbToHex(red, green, blue)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0]
}

/** Darkest pixel inside the rect, used as the text color. */
function inkInside(canvas: HTMLCanvasElement, r: DOMRect): string {
  let darkest: [number, number, number] = [31, 41, 55]
  let best = Number.POSITIVE_INFINITY
  for (let i = 1; i < 20; i++) {
    for (let j = 1; j < 6; j++) {
      const s = sampleCanvas(canvas, r.left + (r.width * i) / 20, r.top + (r.height * j) / 6)
      if (s && luminance(s) < best) {
        best = luminance(s)
        darkest = s
      }
    }
  }
  return rgbToHex(...darkest)
}

function fontFromCss(fontFamily: string): FontFamily {
  const name = fontFamily.toLowerCase()
  const match: [string, FontFamily][] = [
    ['dejavu sans mono', 'mono'],
    ['dejavu serif', 'serif'],
    ['dejavu sans', 'sans'],
    ['courier', 'courier'],
    ['consolas', 'consolas'],
    ['calibri', 'calibri'],
    ['times', 'times'],
    ['georgia', 'georgia'],
    ['verdana', 'verdana'],
    ['trebuchet', 'trebuchet'],
    ['segoe', 'segoe'],
    ['palatino', 'palatino'],
    ['candara', 'candara'],
    ['constantia', 'constantia'],
    ['corbel', 'corbel'],
    ['tahoma', 'tahoma'],
    ['arial', 'arial']
  ]
  for (const [needle, family] of match) {
    if (name.includes(needle)) return family
  }
  if (name.includes('mono')) return 'mono'
  if (name.includes('serif') && !name.includes('sans')) return 'serif'
  return 'sans'
}

/**
 * Maps a PDF font name such as "ABCDEF+LiberationSans-Bold" or "Arial,Bold" to
 * a face we can draw with. Metric-compatible clones map to the Windows font.
 */
function fontFromPdfName(pdfName: string): { font: FontFamily; bold: boolean; italic: boolean } | null {
  const name = pdfName.replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[\s_-]/g, '')
  if (!name) return null
  const match: [string, FontFamily][] = [
    ['liberationsans', 'arial'],
    ['arimo', 'arial'],
    ['helvetica', 'arial'],
    ['arial', 'arial'],
    ['liberationserif', 'times'],
    ['tinos', 'times'],
    ['times', 'times'],
    ['liberationmono', 'courier'],
    ['cousine', 'courier'],
    ['courier', 'courier'],
    ['carlito', 'calibri'],
    ['calibri', 'calibri'],
    ['tahoma', 'tahoma'],
    ['verdana', 'verdana'],
    ['georgia', 'georgia'],
    ['trebuchet', 'trebuchet'],
    ['segoe', 'segoe'],
    ['consolas', 'consolas'],
    ['palatino', 'palatino'],
    ['candara', 'candara'],
    ['constantia', 'constantia'],
    ['corbel', 'corbel'],
    ['dejavusansmono', 'mono'],
    ['dejavuserif', 'serif'],
    ['dejavusans', 'sans']
  ]
  const hit = match.find(([needle]) => name.includes(needle))
  if (!hit) return null
  return {
    font: hit[1],
    bold: /bold|black|heavy|semibold|demi/.test(name),
    italic: /italic|oblique/.test(name)
  }
}

/** Ascent and descent (em fractions) of each face, for placing the baseline. */
function fontMetrics(font: FontFamily): { ascent: number; descent: number } {
  switch (font) {
    case 'sans':
    case 'mono':
      return { ascent: 0.928, descent: 0.236 }
    case 'serif':
      return { ascent: 0.939, descent: 0.236 }
    case 'times':
      return { ascent: 0.891, descent: 0.216 }
    case 'courier':
      return { ascent: 0.833, descent: 0.3 }
    case 'calibri':
      return { ascent: 0.75, descent: 0.25 }
    case 'tahoma':
      return { ascent: 1.0, descent: 0.207 }
    case 'verdana':
      return { ascent: 1.005, descent: 0.21 }
    default:
      return { ascent: 0.905, descent: 0.212 }
  }
}

/** "Edit Text": replaces a text run on the page through an editable box. */
export function editPageText(span: HTMLElement, pageIndex: number): void {
  const text = span.textContent ?? ''
  const wrapper = pageWrapper(pageIndex + 1)
  const doc = useAppStore.getState().document
  if (!wrapper || !doc || text.trim() === '') return
  commitDraft()
  const { zoom } = useAppStore.getState()
  const size = doc.pageSizes[pageIndex]
  const clientRect = span.getBoundingClientRect()
  const rect = clientRectToPage(clientRect, wrapper.getBoundingClientRect(), size, zoom)
  const canvas = wrapper.querySelector('canvas')
  const pdfSize = Number(span.dataset.pdfSize)
  const fontSize = Math.max(4, Math.round((pdfSize > 0 ? pdfSize : rect.height) * 10) / 10)
  const baseline = span.dataset.pdfBaseline ? Number(span.dataset.pdfBaseline) : NaN
  const pdfX = span.dataset.pdfX ? Number(span.dataset.pdfX) : NaN
  const { settings } = useEditStore.getState()
  const style = {
    ...settings.text,
    font: usableFont(fontFromCss(span.style.fontFamily)),
    size: fontSize,
    color: canvas ? inkInside(canvas, clientRect) : settings.text.color,
    bold: false,
    italic: false,
    align: 'left' as const
  }
  const lineH = fontSize * 1.2
  /** Top of the box that puts the new baseline exactly on the old one. */
  const topFor = (font: FontFamily): number => {
    if (!Number.isFinite(baseline)) return rect.y - (lineH - rect.height) / 2
    const { ascent, descent } = fontMetrics(font)
    return baseline - ((lineH - (ascent + descent) * fontSize) / 2 + ascent * fontSize)
  }
  const token = nextDraftToken()
  useEditStore.getState().select(null)
  useEditStore.getState().setDraft({
    kind: 'text',
    id: null,
    pageIndex,
    x: rect.x,
    y: topFor(style.font),
    width: Math.max(rect.width, measureText(text, style)) + fontSize * 0.5,
    rotation: 0,
    text,
    originalText: text,
    style,
    fill: settings.comment.fill,
    border: settings.comment.border,
    cover: {
      x: rect.x - 1,
      y: rect.y - 1,
      width: rect.width + 2,
      height: rect.height + 2,
      color: canvas ? backgroundAround(canvas, clientRect) : '#ffffff'
    },
    token
  })

  // Switch to the original typeface once it is known (MuPDF loads on first use).
  if (!Number.isFinite(baseline) || !Number.isFinite(pdfX)) return
  void fontAt(doc.bytes, pageIndex, size, pdfX, baseline).then((runFont) => {
    const draft = useEditStore.getState().draft
    if (!runFont || !draft || draft.token !== token) return
    const match = fontFromPdfName(runFont.name)
    const font = usableFont(match?.font ?? draft.style.font)
    const next = {
      ...draft.style,
      font,
      bold: runFont.bold || Boolean(match?.bold),
      italic: runFont.italic || Boolean(match?.italic)
    }
    useEditStore.getState().updateDraft({
      style: next,
      y: topFor(font),
      width: Math.max(rect.width, measureText(draft.text, next)) + fontSize * 0.5
    })
  })
}
