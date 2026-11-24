import { useEffect } from 'react'
import { DialogHost } from './components/dialogs/DialogHost'
import { BusyOverlay } from './components/layout/BusyOverlay'
import { PhoneApp } from './components/phone/PhoneApp'
import { DefaultAppBanner } from './components/layout/DefaultAppBanner'
import { DocumentTabs } from './components/layout/DocumentTabs'
import { NoticeBar } from './components/layout/NoticeBar'
import { PropertiesBar } from './components/layout/PropertiesBar'
import { Ribbon } from './components/layout/Ribbon'
import { Sidebar } from './components/layout/Sidebar'
import { StatusBar } from './components/layout/StatusBar'
import { TitleBar } from './components/layout/TitleBar'
import { EmptyState } from './components/viewer/EmptyState'
import { PdfViewer } from './components/viewer/PdfViewer'
import { registerFonts } from './editing/fonts'
import { anyDocumentDirty, confirmEveryUnsaved, openFromPath } from './services/fileService'
import { useShortcuts } from './shortcuts/useShortcuts'
import { useAppStore } from './store/useAppStore'
import { useEditStore } from './store/useEditStore'

function useExternalFileOpening(): void {
  useEffect(() => {
    void window.api.getPendingFile().then((path) => {
      if (path) void openFromPath(path)
    })
    return window.api.onOpenExternalFile((path) => void openFromPath(path))
  }, [])
}

function useUnsavedCloseGuard(): void {
  useEffect(() => {
    const syncDirty = (): void => {
      window.api.setDirty(anyDocumentDirty())
    }
    syncDirty()
    const unsubApp = useAppStore.subscribe(syncDirty)
    const unsubEdit = useEditStore.subscribe(syncDirty)
    return () => {
      unsubApp()
      unsubEdit()
      window.api.setDirty(false)
    }
  }, [])

  useEffect(() => {
    return window.api.onCloseRequested(() => {
      void confirmEveryUnsaved().then((ok) => {
        if (ok) window.api.confirmClose()
      })
    })
  }, [])
}

export default function App(): JSX.Element {
  const doc = useAppStore((s) => s.document)
  const activeDocumentId = useAppStore((s) => s.activeDocumentId)

  useShortcuts()
  useExternalFileOpening()
  useUnsavedCloseGuard()

  useEffect(() => {
    registerFonts()
  }, [])

  // The phone has its own layout; the desktop ribbon, tabs and sidebar never show there.
  if (__ANDROID__) return <PhoneApp />

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <DocumentTabs />
      <Ribbon />
      <PropertiesBar />
      <DefaultAppBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          {doc ? <PdfViewer key={activeDocumentId ?? doc.name} doc={doc} /> : <EmptyState />}
          <NoticeBar />
        </main>
      </div>
      <StatusBar />
      <DialogHost />
      <BusyOverlay />
    </div>
  )
}
