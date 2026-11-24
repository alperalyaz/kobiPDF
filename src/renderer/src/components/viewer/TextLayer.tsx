import { useEffect, useRef } from 'react'
import { TextLayer as PdfTextLayer, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

interface TextLayerProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  /** Enables clicking spans (used by "Edit Text"). */
  onSpanPointerDown?: (span: HTMLElement, event: PointerEvent) => void
  className?: string
}

/**
 * Selectable text for one page, laid out in the unrotated page frame. It scales
 * with the parent's --total-scale-factor, so zooming never rebuilds it.
 */
export function TextLayer({ pdf, pageNumber, onSpanPointerDown, className = '' }: TextLayerProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const handlerRef = useRef(onSpanPointerDown)
  handlerRef.current = onSpanPointerDown

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let layer: PdfTextLayer | null = null
    container.replaceChildren()

    void pdf.getPage(pageNumber).then(async (page) => {
      if (cancelled) return
      const textContent = await page.getTextContent({ includeMarkedContent: true, disableNormalization: true })
      if (cancelled) return
      layer = new PdfTextLayer({
        textContentSource: textContent,
        container,
        viewport: page.getViewport({ scale: 1, rotation: 0 })
      })
      try {
        await layer.render()
      } catch {
        // Cancelled or a page without text.
        return
      }
      annotateSpans(layer, textContent.items, page)
    })
    return () => {
      cancelled = true
      layer?.cancel()
    }
  }, [pdf, pageNumber])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement
      if (handlerRef.current && target.tagName === 'SPAN' && target.parentElement && container.contains(target)) {
        handlerRef.current(target, event)
      }
    }
    container.addEventListener('pointerdown', onPointerDown)
    return () => container.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return <div ref={containerRef} className={`textLayer ${className}`} />
}

/**
 * Stores each run's size, start and baseline on its span, so "Edit Text"
 * can reuse the original typeface and sit the new text on the old baseline.
 */
function annotateSpans(layer: PdfTextLayer, items: unknown[], page: PDFPageProxy): void {
  const textItems = items.filter((item): item is TextItem => typeof (item as TextItem).str === 'string')
  const divs = layer.textDivs
  const strings = layer.textContentItemsStr
  // Only trust the pairing when pdf.js produced exactly one div per text item.
  if (divs.length !== textItems.length || strings.some((str, i) => str !== textItems[i].str)) return
  const [, , , viewTop] = page.view
  textItems.forEach((item, i) => {
    const div = divs[i]
    const [a, b, c, d, , f] = item.transform
    div.dataset.pdfX = String(item.transform[4] - page.view[0])
    div.dataset.pdfSize = String(Math.hypot(c, d))
    div.dataset.pdfBaseline = String(viewTop - f)
    // Writing direction as a clockwise angle in the page frame (y down): bottom-to-top text is 270.
    const angle = Math.round((Math.atan2(-b, a) * 180) / Math.PI)
    div.dataset.pdfAngle = String((angle + 360) % 360)
    div.dataset.pdfWidth = String(item.width)
  })
}
