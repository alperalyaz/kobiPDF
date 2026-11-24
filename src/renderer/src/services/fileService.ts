import { PDFDocument } from 'pdf-lib'
import type { OpenedFile, Result } from '../../../shared/ipc'
import { openDialog } from '../components/dialogs/dialogStore'
import { commitDraft } from '../editing/draft'
import { exportEdits } from '../editing/exportEdits'
import { withKobiMetadata } from '../editing/pdfMetadata'
import { isDirty, markSaved } from '../editing/history'
import { useAppStore } from '../store/useAppStore'
import { useEditStore } from '../store/useEditStore'
import i18n from '../locales/i18n'
import { closeTab, discardParked, openInTab } from './documentTabs'
import { isBusy, runBusy } from './busy'
import { loadPdf, PdfLoadError } from './pdfService'
import { mountPrintRoot, renderPrintPages } from './printService'

const store = useAppStore.getState
const edit = useEditStore.getState

export function reportFailure(result: Extract<Result<unknown>, { ok: false }>): void {
  if (result.code === 'CANCELLED') return
  if (result.message) console.error(result.code, result.message)
  store().showNotice({ kind: 'error', key: `errors.${result.code}` })
}

/** Shows a notice for errors thrown while modifying a document with pdf-lib. */
export function reportEditError(err: unknown): void {
  console.error(err)
  const encrypted = err instanceof Error && /encrypt/i.test(`${err.name} ${err.message}`)
  store().showNotice({ kind: 'error', key: encrypted ? 'errors.ENCRYPTED' : 'errors.editFailed' })
}

/** Commits the open text box and returns the bytes with all edits written into the PDF. */
export async function exportCurrent(): Promise<Uint8Array | null> {
  commitDraft()
  const doc = store().document
  if (!doc) return null
  return exportEdits(doc.bytes, edit().objects, doc.pageSizes)
}

/** Shows a document in its own tab and starts a fresh edit history. */
export async function showDocument(
  file: { path: string | null; name: string; data: Uint8Array },
  options: { unsaved?: boolean } = {}
): Promise<void> {
  const { pdf, pageSizes } = await loadPdf(file.data)
  await openInTab(file, { pdf, pageSizes }, options.unsaved ? null : file.data)
}

async function loadOpenedFile(result: Result<OpenedFile>): Promise<void> {
  if (!result.ok) {
    reportFailure(result)
    return
  }
  const { setLoading, showNotice } = store()
  setLoading(true)
  try {
    await showDocument(result.value)
    showNotice(null)
  } catch (err) {
    console.error(err)
    const code = err instanceof PdfLoadError ? err.code : 'UNKNOWN'
    showNotice({ kind: 'error', key: `errors.${code}` })
  } finally {
    setLoading(false)
  }
}

/** Asks what to do with unsaved changes. Resolves true when it is fine to continue. */
export async function confirmUnsaved(): Promise<boolean> {
  commitDraft()
  const doc = store().document
  if (!doc || !isDirty(store(), edit())) return true
  const choice = await openDialog({ type: 'unsaved', name: doc.name })
  if (choice === 'cancel') return false
  if (choice === 'discard') return true
  return save()
}

export async function openFromDialog(): Promise<void> {
  await loadOpenedFile(await window.api.openFile())
}

/**
 * Phone: one document at a time (memory, and no tab strip). Settles the open document's unsaved
 * changes first, then replaces it with the picked file. Cancelling the picker keeps the old one.
 */
export async function openReplacing(): Promise<void> {
  if (isBusy()) return
  const previous = store().activeDocumentId
  if (previous && !(await confirmUnsaved())) return
  await openFromDialog()
  const current = store().activeDocumentId
  if (previous && current !== previous) await discardParked(previous)
}

let untitledCount = 0

/** Asks for a page size and opens a new document with one blank page in its own tab. */
export async function newDocument(): Promise<void> {
  const size = await openDialog({ type: 'newDocument' })
  if (!size) return
  const pdf = await PDFDocument.create()
  pdf.addPage([size.width, size.height])
  untitledCount += 1
  const base = i18n.t('common.untitled')
  const name = untitledCount === 1 ? `${base}.pdf` : `${base} ${untitledCount}.pdf`
  store().setLoading(true)
  try {
    await showDocument({ path: null, name, data: await pdf.save() }, { unsaved: true })
  } finally {
    store().setLoading(false)
  }
}

export async function openFromPath(path: string): Promise<void> {
  // Android: "path" only signals that another app handed over a PDF; it waits in the incoming queue.
  if (__ANDROID__) return openIncoming()
  await loadOpenedFile(await window.api.readFile(path))
}

let incomingChain: Promise<void> = Promise.resolve()

/**
 * Android: opens the newest PDF from another app. Runs one at a time; a file that arrives during a save
 * waits for it. The file is copied and checked first, so the "save changes?" question is only asked
 * for a file that will really open; then it replaces the open document (one document on a phone).
 */
function openIncoming(): Promise<void> {
  incomingChain = incomingChain.then(openIncomingNow).catch((err) => console.error(err))
  return incomingChain
}

async function openIncomingNow(): Promise<void> {
  const api = window.api
  if (!api.takeIncomingFile || !api.readIncomingFile) return
  while (isBusy()) await new Promise((resolve) => window.setTimeout(resolve, 300))
  const item = await api.takeIncomingFile()
  if (!item) return
  const read = api.readIncomingFile
  const result = await runBusy('common.loading', () => read(item.id, item.name))
  if (!result.ok) {
    reportFailure(result)
    return
  }
  const previous = store().activeDocumentId
  if (previous && !(await confirmUnsaved())) return
  await loadOpenedFile(result)
  const current = store().activeDocumentId
  if (previous && current !== previous) await discardParked(previous)
}

async function exportOrReport(): Promise<Uint8Array | null> {
  try {
    return await exportCurrent()
  } catch (err) {
    reportEditError(err)
    return null
  }
}

const SAVING = 'common.saving'

/** The bytes to write: all edits applied and kobiPDF in the document info. Slow for large files. */
async function prepareBytes(): Promise<Uint8Array | null> {
  const bytes = await exportOrReport()
  return bytes ? withKobiMetadata(bytes) : null
}

async function writeAs(name: string, bytes: Uint8Array): Promise<boolean> {
  const result = await window.api.saveFileAs(bytes, name)
  if (!result.ok) {
    reportFailure(result)
    return false
  }
  store().updateDocument({ path: result.value.path, name: result.value.name })
  markSaved()
  store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.location ?? result.value.name } })
  return true
}

export async function saveAs(): Promise<boolean> {
  if (isBusy()) return false
  const doc = store().document
  if (!doc) return false
  // Android has no save dialog, so writing belongs to the long work. On the desktop the dialog
  // must not sit behind the busy overlay.
  if (__ANDROID__) {
    return runBusy(SAVING, async () => {
      const bytes = await prepareBytes()
      return bytes ? writeAs(doc.name, bytes) : false
    })
  }
  const bytes = await runBusy(SAVING, prepareBytes)
  return bytes ? writeAs(doc.name, bytes) : false
}

export async function save(): Promise<boolean> {
  if (isBusy()) return false
  const doc = store().document
  if (!doc) return false
  if (!doc.path) return saveAs()
  const path = doc.path
  return runBusy(SAVING, async () => {
    const bytes = await prepareBytes()
    if (!bytes) return false
    const result = await window.api.saveFile(path, bytes)
    if (!result.ok) {
      reportFailure(result)
      return false
    }
    markSaved()
    store().showNotice({ kind: 'info', key: 'messages.saved', params: { name: result.value.location ?? result.value.name } })
    return true
  })
}

/** Android: saves (a copy, the first time) and opens the share sheet for that file. */
export async function share(): Promise<void> {
  if (isBusy() || !window.api.shareFile || !(await save())) return
  // The busy overlay is gone by now, so it does not sit over the share sheet.
  const path = store().document?.path
  if (path) await window.api.shareFile(path)
}

export async function print(): Promise<void> {
  const doc = store().document
  if (!doc) return
  const bytes = await exportOrReport()
  if (!bytes) return
  store().setLoading(true)
  let revoke: (() => void) | null = null
  let unmount: (() => void) | null = null
  let printDoc = doc.pdf
  try {
    if (bytes !== doc.bytes) printDoc = (await loadPdf(bytes)).pdf
    const rendered = await renderPrintPages(printDoc)
    revoke = rendered.revoke
    const printers = await window.api.getPrinters().catch(() => [])
    store().setLoading(false)
    const choice = await openDialog({
      type: 'print',
      pageCount: rendered.pages.length,
      currentPage: Math.min(store().currentPage, rendered.pages.length),
      previews: rendered.pages,
      printers
    })
    if (!choice) return
    const selected = rendered.pages.filter((page) => choice.pages.includes(page.page))
    unmount = mountPrintRoot(selected)
    const result = await window.api.print({ deviceName: choice.deviceName, copies: choice.copies })
    if (!result.ok) reportFailure(result)
  } catch (err) {
    console.error(err)
    store().showNotice({ kind: 'error', key: 'errors.printFailed' })
  } finally {
    unmount?.()
    revoke?.()
    if (printDoc !== doc.pdf) void printDoc.loadingTask.destroy()
    store().setLoading(false)
  }
}

export async function closeDocument(id?: string): Promise<void> {
  await closeTab(id)
}

export { confirmEveryUnsaved, anyDocumentDirty } from './documentTabs'
