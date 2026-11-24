import { openDialog } from '../components/dialogs/dialogStore'
import { reportFailure } from '../services/fileService'
import { useAppStore } from '../store/useAppStore'
import { useEditStore } from '../store/useEditStore'
import { commitDraft, uprightRotation } from './draft'
import { clientToPage } from './geometry'
import { addObject } from './history'
import { newId, type ImageObject, type Point } from './types'

const store = useAppStore.getState

/** CSS pixels to PDF points. */
const PX_TO_PT = 0.75

function toDataUrl(bytes: Uint8Array, format: 'png' | 'jpg'): Promise<string> {
  const blob = new Blob([bytes.slice()], { type: format === 'png' ? 'image/png' : 'image/jpeg' })
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function naturalSize(src: string): Promise<{ width: number; height: number }> {
  const img = new Image()
  img.src = src
  await img.decode()
  return { width: img.naturalWidth, height: img.naturalHeight }
}

/**
 * The page and the page point at the middle of what the viewer shows, so a new image lands where the
 * user is looking (a tall page's own center may be off screen). Null when no page is laid out.
 */
function visibleCenter(): { pageIndex: number; point: Point } | null {
  const doc = store().document
  const viewer = document.querySelector<HTMLElement>('[data-viewer]')
  if (!doc || !viewer) return null
  const view = viewer.getBoundingClientRect()
  const cx = view.left + view.width / 2
  const cy = view.top + view.height / 2
  let best: { el: HTMLElement; distance: number } | null = null
  for (const el of viewer.querySelectorAll<HTMLElement>('[data-page]')) {
    const r = el.getBoundingClientRect()
    const distance = Math.max(0, r.top - cy, cy - r.bottom)
    if (!best || distance < best.distance) best = { el, distance }
  }
  if (!best) return null
  const pageIndex = Number(best.el.dataset.page) - 1
  const page = doc.pageSizes[pageIndex]
  if (!page) return null
  const r = best.el.getBoundingClientRect()
  const x = Math.min(Math.max(cx, r.left), r.right)
  const y = Math.min(Math.max(cy, r.top), r.bottom)
  return { pageIndex, point: clientToPage(x, y, r, page, store().zoom) }
}

/** Places an image in the middle of the visible area (else the current page), fitting `maxWidth` points. */
function placeImage(
  image: Pick<ImageObject, 'bytes' | 'src' | 'format' | 'signature'>,
  size: { width: number; height: number },
  maxWidth: number
): void {
  const doc = store().document
  if (!doc) return
  const target = visibleCenter()
  const pageIndex = target?.pageIndex ?? store().currentPage - 1
  const page = doc.pageSizes[pageIndex]
  const rotation = uprightRotation(pageIndex)
  const sideways = rotation % 180 !== 0
  const limitW = Math.min(maxWidth, (sideways ? page.baseHeight : page.baseWidth) * 0.8)
  const limitH = (sideways ? page.baseWidth : page.baseHeight) * 0.8
  const scale = Math.min(1, limitW / size.width, limitH / size.height)
  const width = size.width * scale
  const height = size.height * scale
  const center = target?.point ?? { x: page.baseWidth / 2, y: page.baseHeight / 2 }
  const clamp = (value: number, max: number): number => Math.min(Math.max(value, 0), Math.max(0, max))
  const id = newId()
  addObject({
    id,
    kind: 'image',
    pageIndex,
    x: clamp(center.x - width / 2, page.baseWidth - width),
    y: clamp(center.y - height / 2, page.baseHeight - height),
    width,
    height,
    rotation,
    ...image
  })
  if (__ANDROID__) {
    // The phone has no object tool: select it right away so it can be moved and resized.
    store().setActiveTool('select')
    useEditStore.getState().select(id)
  } else if (store().activeTool !== 'select' && store().activeTool !== 'editObject') {
    store().setActiveTool('editObject')
  }
}

export async function insertImage(signature = false): Promise<void> {
  commitDraft()
  if (!store().document) return
  const result = await window.api.openImage()
  if (!result.ok) return reportFailure(result)
  try {
    const { data, format } = result.value
    const src = await toDataUrl(data, format)
    const px = await naturalSize(src)
    placeImage(
      { bytes: data, src, format, signature },
      { width: px.width * PX_TO_PT, height: px.height * PX_TO_PT },
      signature ? 180 : 400
    )
  } catch (err) {
    console.error(err)
    store().showNotice({ kind: 'error', key: 'errors.UNSUPPORTED_IMAGE' })
  }
}

export async function drawSignature(): Promise<void> {
  commitDraft()
  if (!store().document) return
  const signature = await openDialog({ type: 'signature' })
  if (!signature) return
  placeImage(
    { bytes: signature.bytes, src: signature.src, format: signature.format, signature: true },
    { width: signature.width * PX_TO_PT, height: signature.height * PX_TO_PT },
    180
  )
}
