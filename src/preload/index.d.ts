import type { KobiPdfApi } from '../shared/ipc'

declare global {
  interface Window {
    api: KobiPdfApi
  }
}

export {}
