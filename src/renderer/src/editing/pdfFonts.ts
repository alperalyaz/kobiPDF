import type { PageSize } from '../store/useAppStore'

export interface RunFont {
  /** As stored in the file, e.g. "ABCDEF+Arial,Bold". */
  name: string
  bold: boolean
  italic: boolean
}

type MupdfDocument = import('mupdf').PDFDocument

let cached: { bytes: Uint8Array; doc: MupdfDocument } | null = null

/**
 * Finds the font of the text run that starts at (x, baseline) in the page
 * frame. pdf.js no longer reports real font names, so MuPDF reads them.
 */
export async function fontAt(
  bytes: Uint8Array,
  pageIndex: number,
  info: PageSize,
  x: number,
  baseline: number
): Promise<RunFont | null> {
  try {
    const mupdf = await import('mupdf')
    if (cached?.bytes !== bytes) {
      cached?.doc.destroy()
      cached = { bytes, doc: mupdf.Document.openDocument(bytes, 'application/pdf') as MupdfDocument }
    }
    const page = cached.doc.loadPage(pageIndex)
    const [a, b, c, d, e, f] = page.getTransform()
    const ux = info.viewBox[0] + x
    const uy = info.viewBox[3] - baseline
    const px = a * ux + c * uy + e
    const py = b * ux + d * uy + f
    let best: import('mupdf').Font | null = null
    let bestDistance = Infinity
    page.toStructuredText('preserve-whitespace').walk({
      onChar(_c, origin, font) {
        const distance = Math.hypot(origin[0] - px, origin[1] - py)
        if (distance < bestDistance) {
          bestDistance = distance
          best = font
        }
      }
    })
    const font = best as import('mupdf').Font | null
    if (!font || bestDistance > 3) return null
    return { name: font.getName(), bold: font.isBold(), italic: font.isItalic() }
  } catch (err) {
    console.error('Could not read the font of the edited text', err)
    return null
  }
}
