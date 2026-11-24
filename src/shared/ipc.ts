export const IpcChannels = {
  fileOpen: 'file:open',
  fileOpenMany: 'file:open-many',
  fileReadPath: 'file:read-path',
  fileSave: 'file:save',
  fileSaveAs: 'file:save-as',
  fileOpenExternal: 'file:open-external',
  imageOpen: 'image:open',
  dirPick: 'dir:pick',
  fileWriteInDir: 'file:write-in-dir',
  appPrint: 'app:print',
  appGetPrinters: 'app:get-printers',
  appGetPendingFile: 'app:get-pending-file',
  appSetDirty: 'app:set-dirty',
  appCloseRequested: 'app:close-requested',
  appConfirmClose: 'app:confirm-close',
  appDefaultPdfStatus: 'app:default-pdf-status',
  appOpenDefaultApps: 'app:open-default-apps',
  fontsList: 'fonts:list',
  fontsRead: 'fonts:read'
} as const

/** Document fonts read from the OS font folder. The installer does not ship these files. */
export const SYSTEM_FONT_IDS = [
  'arial',
  'times',
  'calibri',
  'georgia',
  'verdana',
  'courier',
  'trebuchet',
  'segoe',
  'consolas',
  'palatino',
  'candara',
  'constantia',
  'corbel',
  'tahoma'
] as const

export type SystemFontId = (typeof SYSTEM_FONT_IDS)[number]

export type FileErrorCode =
  | 'CANCELLED'
  | 'EACCES'
  | 'ENOENT'
  | 'CORRUPT'
  | 'NOT_ALLOWED'
  | 'UNSUPPORTED_IMAGE'
  | 'UNKNOWN'

export type Result<T> = { ok: true; value: T } | { ok: false; code: FileErrorCode; message?: string }

export interface OpenedFile {
  /** null on Android: a picked file has no lasting path, so Save writes a copy instead. */
  path: string | null
  name: string
  data: Uint8Array
}

export interface OpenedImage {
  name: string
  data: Uint8Array
  format: 'png' | 'jpg'
}

export interface SavedFile {
  path: string
  name: string
  /** Where the user can find the file, when the name alone does not say it (Android). */
  location?: string
}

export type AppLanguage = 'tr' | 'en'

/** 'unsupported': not Windows, or a development build that Windows does not know about. */
export type DefaultPdfStatus = 'default' | 'notDefault' | 'unsupported'

export interface PrinterInfo {
  name: string
  displayName: string
}

export interface PrintRequest {
  deviceName?: string
  copies: number
}

export interface KobiPdfApi {
  platform: string
  openFile: () => Promise<Result<OpenedFile>>
  openFiles: () => Promise<Result<OpenedFile[]>>
  readFile: (path: string) => Promise<Result<OpenedFile>>
  saveFile: (path: string, data: Uint8Array) => Promise<Result<SavedFile>>
  saveFileAs: (data: Uint8Array, suggestedName?: string) => Promise<Result<SavedFile>>
  openImage: () => Promise<Result<OpenedImage>>
  pickDirectory: () => Promise<Result<string>>
  writeInDirectory: (dir: string, fileName: string, data: Uint8Array) => Promise<Result<SavedFile>>
  getPrinters: () => Promise<PrinterInfo[]>
  print: (request: PrintRequest) => Promise<Result<void>>
  listSystemFonts: () => Promise<SystemFontId[]>
  readSystemFont: (id: SystemFontId, variant: number) => Promise<Uint8Array | null>
  getPendingFile: () => Promise<string | null>
  getDefaultPdfStatus: () => Promise<DefaultPdfStatus>
  openDefaultAppsSettings: () => Promise<void>
  setDirty: (dirty: boolean) => void
  confirmClose: () => void
  onCloseRequested: (callback: () => void) => () => void
  onOpenExternalFile: (callback: (path: string) => void) => () => void
  /** Opens the system share sheet for a saved file. Android only. */
  shareFile?: (path: string) => Promise<void>
  /**
   * Android: the newest PDF another app handed over ("Open with", "Share"), taken off the queue; null when
   * none waits. onOpenExternalFile only signals that one arrived.
   */
  takeIncomingFile?: () => Promise<{ id: string; name: string } | null>
  /** Android: reads a file from takeIncomingFile (copied and checked to be a PDF natively), then forgets it. */
  readIncomingFile?: (id: string, name: string) => Promise<Result<OpenedFile>>
}
