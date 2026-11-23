import type { PageSize } from '../store/useAppStore'
import type { Rect } from './types'

export interface TextErase {
  pageIndex: number
  /** Page-frame rect (top-left origin, y down) of the original text run. */
  rect: Rect
}

// Constants from MuPDF's pdf_redact_options.
const IMAGE_NONE = 0
const LINE_ART_NONE = 0
const TEXT_REMOVE = 0

/**
 * Really deletes the original glyphs under each rect (MuPDF redaction), so
 * replaced text cannot be found by search or copy. Images and lines are kept.
 * Returns null when MuPDF cannot process the file; the caller then falls back
 * to painting over the old text.
 */
export async function eraseText(
  bytes: Uint8Array,
  erases: TextErase[],
  pageSizes: PageSize[]
): Promise<Uint8Array | null> {
  if (erases.length === 0) return bytes
  let doc: import('mupdf').PDFDocument | undefined
  try {
    // Loaded on first use: the WebAssembly module is large.
    const mupdf = await import('mupdf')
    doc = mupdf.Document.openDocument(bytes, 'application/pdf') as import('mupdf').PDFDocument
    const byPage = new Map<number, Rect[]>()
    for (const e of erases) byPage.set(e.pageIndex, [...(byPage.get(e.pageIndex) ?? []), e.rect])

    for (const [pageIndex, rects] of byPage) {
      const info = pageSizes[pageIndex]
      if (!info) continue
      const page = doc.loadPage(pageIndex)
      const toPage = page.getTransform()
      const [vx0, , , vy1] = info.viewBox
      for (const r of rects) {
        // Trim the top and bottom so tightly spaced neighbour lines stay intact.
        const inset = r.height * 0.2
        const user: [number, number, number, number] = [
          vx0 + r.x,
          vy1 - (r.y + r.height - inset),
          vx0 + r.x + r.width,
          vy1 - (r.y + inset)
        ]
        const annot = page.createAnnotation('Redact')
        annot.setRect(mupdf.Rect.transform(user, toPage))
      }
      page.applyRedactions(false, IMAGE_NONE, LINE_ART_NONE, TEXT_REMOVE)
    }
    return doc.saveToBuffer('compress').asUint8Array().slice()
  } catch (err) {
    console.error('Text erase failed, falling back to cover boxes', err)
    return null
  } finally {
    doc?.destroy()
  }
}
