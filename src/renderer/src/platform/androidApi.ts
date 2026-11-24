// Android (Capacitor) implementation of window.api. Installed by main.tsx before any other module loads.
//
// Files: a picked PDF has no lasting path (content:// with a temporary grant), so OpenedFile.path is null and
// Save falls back to Save As, which writes a copy to Documents/kobiPDF. Later saves overwrite that copy only.
// Sharing is a separate action (shareFile), never a side effect of saving.
import { App } from '@capacitor/app'
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { FileErrorCode, KobiPdfApi, OpenedFile, OpenedImage, PdfHandler, Result, SavedFile } from '../../../shared/ipc'
import i18n from '../locales/i18n'
import { runBack } from './back'

const FOLDER = 'kobiPDF'
const DIR = Directory.Documents
/** Bytes per bridge call. A multiple of 3 so each piece encodes to base64 without padding. */
const CHUNK = 3 * 512 * 1024
const MAX_NAME_TRIES = 50

const fail = <T>(code: FileErrorCode, err?: unknown): Result<T> => {
  if (err) console.error(code, err)
  return { ok: false, code, message: err instanceof Error ? err.message : err ? String(err) : undefined }
}

// ---------- picking files ----------

/** Opens the system file picker. Resolves [] when the user backs out. */
function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    // A fresh input each time, so picking the same file twice still fires `change`.
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    document.body.appendChild(input)
    let done = false
    const finish = (files: File[]): void => {
      if (done) return
      done = true
      window.removeEventListener('focus', onFocus)
      input.remove()
      resolve(files)
    }
    // Fallback for pickers that close without a `cancel` event: when the app regains focus and no
    // file arrived shortly after, treat it as cancelled.
    const onFocus = (): void => {
      window.setTimeout(() => finish(Array.from(input.files ?? [])), 1500)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => finish([]))
    window.addEventListener('focus', onFocus)
    input.click()
  })
}

/** Providers may hand out names such as "document:1234"; make it a safe "<name>.pdf". */
function pdfName(raw: string): string {
  const cleaned = raw.replace(/[\\/:*?"<>|]+/g, '_').trim() || i18n.t('common.untitled')
  return /\.pdf$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`
}

async function toOpened(file: File): Promise<OpenedFile> {
  return { path: null, name: pdfName(file.name), data: new Uint8Array(await file.arrayBuffer()) }
}

// ---------- writing files ----------

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

let permissionChecked = false

/** Android 9 and older need the storage permission to write to Documents; newer versions always allow it. */
async function ensureWritePermission(): Promise<boolean> {
  if (permissionChecked) return true
  try {
    let status = await Filesystem.checkPermissions()
    if (status.publicStorage !== 'granted') status = await Filesystem.requestPermissions()
    permissionChecked = status.publicStorage === 'granted'
    return permissionChecked
  } catch (err) {
    console.error(err)
    return false
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ path, directory: DIR })
    return true
  } catch {
    return false
  }
}

/** Writes in small pieces to a hidden temp file, so a large PDF never crosses the bridge in one message. */
async function writeTemp(data: Uint8Array): Promise<string> {
  const temp = `${FOLDER}/.kobipdf-${Date.now()}.tmp`
  await Filesystem.writeFile({ path: temp, directory: DIR, recursive: true, data: toBase64(data.subarray(0, CHUNK)) })
  for (let offset = CHUNK; offset < data.length; offset += CHUNK) {
    await Filesystem.appendFile({ path: temp, directory: DIR, data: toBase64(data.subarray(offset, offset + CHUNK)) })
  }
  return temp
}

async function removeQuietly(path: string): Promise<void> {
  await Filesystem.deleteFile({ path, directory: DIR }).catch(() => undefined)
}

function withSuffix(name: string, n: number): string {
  return n === 1 ? name : name.replace(/(\.pdf)?$/i, ` (${n})$1`)
}

function saved(path: string): SavedFile {
  const name = path.slice(path.lastIndexOf('/') + 1)
  return { path, name, location: `${i18n.t('android.documentsFolder')}/${path}` }
}

/** Writes a new file under Documents/kobiPDF without replacing anything: "x.pdf", "x (2).pdf", ... */
async function writeNew(fileName: string, data: Uint8Array): Promise<Result<SavedFile>> {
  if (!(await ensureWritePermission())) return fail('EACCES')
  let temp: string | null = null
  try {
    const written = await writeTemp(data)
    temp = written
    for (let n = 1; n <= MAX_NAME_TRIES; n++) {
      const target = `${FOLDER}/${withSuffix(fileName, n)}`
      if (await exists(target)) continue
      try {
        await Filesystem.rename({ from: written, to: target, directory: DIR, toDirectory: DIR })
        temp = null
        return { ok: true, value: saved(target) }
      } catch (err) {
        // A file left by an earlier install can be invisible to stat yet still block the name.
        console.warn('rename failed, trying the next name', target, err)
      }
    }
    return fail('EACCES', 'no free file name')
  } catch (err) {
    return fail('UNKNOWN', err)
  } finally {
    if (temp) await removeQuietly(temp)
  }
}

/** Replaces one of our own copies. The new bytes are fully written before the old file goes. */
async function overwrite(path: string, data: Uint8Array): Promise<Result<SavedFile>> {
  if (!path.startsWith(`${FOLDER}/`) || path.includes('..')) return fail('NOT_ALLOWED')
  if (!(await ensureWritePermission())) return fail('EACCES')
  let temp: string | null = null
  try {
    temp = await writeTemp(data)
    await removeQuietly(path)
    await Filesystem.rename({ from: temp, to: path, directory: DIR, toDirectory: DIR })
    temp = null
    return { ok: true, value: saved(path) }
  } catch (err) {
    return fail('UNKNOWN', err)
  } finally {
    if (temp) await removeQuietly(temp)
  }
}

// ---------- files from other apps ("Open with", "Share") ----------

interface IncomingFilePluginApi {
  takePending(): Promise<{ id?: string; name?: string }>
  copy(options: { id: string }): Promise<{ path: string }>
  discard(options: { id: string }): Promise<void>
  addListener(event: 'fileAvailable', listener: () => void): Promise<PluginListenerHandle>
}

/** Native side: android/app/src/main/java/com/hidroteknik/kobipdf/IncomingFilePlugin.java. */
const IncomingFile = registerPlugin<IncomingFilePluginApi>('IncomingFile')

/** Value handed to onOpenExternalFile / getPendingFile: "look at the incoming queue". */
const INCOMING = 'incoming'
const externalListeners = new Set<(path: string) => void>()

// Registered once at module level (not in a React effect), so StrictMode or remounts cannot lose a signal.
void IncomingFile.addListener('fileAvailable', () => externalListeners.forEach((cb) => cb(INCOMING)))

function errorCode(err: unknown): FileErrorCode {
  const code = (err as { code?: string } | null)?.code
  return code === 'CORRUPT' || code === 'EACCES' || code === 'ENOENT' ? code : 'UNKNOWN'
}

async function readIncoming(id: string, name: string): Promise<Result<OpenedFile>> {
  try {
    const { path } = await IncomingFile.copy({ id })
    // The local web server streams the cached copy: no base64 over the bridge, even for large files.
    const response = await fetch(Capacitor.convertFileSrc(`file://${path}`))
    if (!response.ok) return fail('UNKNOWN', `HTTP ${response.status}`)
    return { ok: true, value: { path: null, name: pdfName(name), data: new Uint8Array(await response.arrayBuffer()) } }
  } catch (err) {
    return fail(errorCode(err), err)
  } finally {
    await IncomingFile.discard({ id }).catch(() => undefined)
  }
}

// ---------- default PDF app ----------

interface DefaultPdfPluginApi {
  status(): Promise<PdfHandler>
  choose(): Promise<void>
  openSettings(options: { packageName: string }): Promise<void>
  addListener(event: 'chosen', listener: () => void): Promise<PluginListenerHandle>
}

/** Native side: android/app/src/main/java/com/hidroteknik/kobipdf/DefaultPdfPlugin.java. */
const DefaultPdf = registerPlugin<DefaultPdfPluginApi>('DefaultPdf')
const handlerListeners = new Set<(chosen: boolean) => void>()
void DefaultPdf.addListener('chosen', () => handlerListeners.forEach((cb) => cb(true)))
// The "Open with" sheet and the settings page cover the app; it is checked again when it comes back.
void App.addListener('resume', () => handlerListeners.forEach((cb) => cb(false)))

// ---------- back button ----------

let dirty = false
const closeListeners = new Set<() => void>()

void App.addListener('backButton', () => {
  // Dialogs, menus, the open text box and the selection close first (platform/back.ts).
  if (runBack()) return
  if (dirty && closeListeners.size > 0) closeListeners.forEach((cb) => cb())
  else void App.exitApp()
})

// ---------- the API ----------

const androidApi: KobiPdfApi = {
  platform: Capacitor.getPlatform(),

  openFile: async () => {
    const [file] = await pickFiles('application/pdf,.pdf', false)
    if (!file) return fail('CANCELLED')
    try {
      return { ok: true, value: await toOpened(file) }
    } catch (err) {
      return fail('UNKNOWN', err)
    }
  },

  openFiles: async () => {
    const files = await pickFiles('application/pdf,.pdf', true)
    if (files.length === 0) return fail('CANCELLED')
    try {
      return { ok: true, value: await Promise.all(files.map(toOpened)) }
    } catch (err) {
      return fail('UNKNOWN', err)
    }
  },

  // Only used for files this API returned a path for; picked files have none.
  readFile: async () => fail('NOT_ALLOWED'),

  saveFile: (path, data) => overwrite(path, data),

  saveFileAs: (data, suggestedName) => writeNew(pdfName(suggestedName ?? i18n.t('common.untitled')), data),

  openImage: async () => {
    const [file] = await pickFiles('image/png,image/jpeg', false)
    if (!file) return fail('CANCELLED')
    const format: OpenedImage['format'] | null = /png/i.test(file.type)
      ? 'png'
      : /jpe?g/i.test(file.type)
        ? 'jpg'
        : null
    if (!format) return fail('UNSUPPORTED_IMAGE')
    return { ok: true, value: { name: file.name, data: new Uint8Array(await file.arrayBuffer()), format } }
  },

  // There is no folder picker: split and extract always write next to the other copies.
  pickDirectory: async () => ({ ok: true, value: FOLDER }),
  writeInDirectory: async (dir, fileName, data) => {
    if (dir !== FOLDER) return fail('NOT_ALLOWED')
    return writeNew(pdfName(fileName), data)
  },

  getPrinters: async () => [],
  print: async () => fail('NOT_ALLOWED'),

  // Until the bundled metric-compatible fonts arrive, the DejaVu fallback is used.
  listSystemFonts: async () => [],
  readSystemFont: async () => null,

  // At start-up a file may already wait (the app was opened with it): always have the queue checked.
  getPendingFile: async () => INCOMING,
  getDefaultPdfStatus: async () => 'unsupported',
  openDefaultAppsSettings: async () => undefined,

  setDirty: (value) => {
    dirty = value
  },
  confirmClose: () => {
    dirty = false
    void App.exitApp()
  },
  onCloseRequested: (callback) => {
    closeListeners.add(callback)
    return () => closeListeners.delete(callback)
  },
  onOpenExternalFile: (callback) => {
    externalListeners.add(callback)
    return () => externalListeners.delete(callback)
  },

  takeIncomingFile: async () => {
    const { id, name } = await IncomingFile.takePending()
    return id ? { id, name: name ?? '' } : null
  },
  readIncomingFile: readIncoming,

  pdfHandler: () => DefaultPdf.status(),
  choosePdfHandler: () => DefaultPdf.choose(),
  openAppSettings: (packageName) => DefaultPdf.openSettings({ packageName }),
  onPdfHandlerChange: (cb) => {
    handlerListeners.add(cb)
    return () => handlerListeners.delete(cb)
  },
  shareFile: async (path) => {
    try {
      const { uri } = await Filesystem.getUri({ path, directory: DIR })
      await Share.share({ title: path.slice(path.lastIndexOf('/') + 1), url: uri })
    } catch (err) {
      // Closing the share sheet rejects too; that is not an error for the user.
      console.warn('share closed or failed', err)
    }
  }
}

;(window as { api?: KobiPdfApi }).api = androidApi
