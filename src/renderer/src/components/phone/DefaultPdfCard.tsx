import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck2, X } from 'lucide-react'
import type { PdfHandler } from '../../../../shared/ipc'
import { useAppStore } from '../../store/useAppStore'

const DISMISS_KEY = 'kobipdf.defaultPrompt.dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The step that brings kobiPDF closer to opening PDFs: when another app was chosen with "Always", its
 * settings page (where "Open by default" is cleared); otherwise the system's "Open with" sheet.
 */
export function takePdfHandlerStep(handler: PdfHandler): void {
  if (handler.state === 'other' && handler.packageName) void window.api.openAppSettings?.(handler.packageName)
  else if (handler.state === 'none') void window.api.choosePdfHandler?.()
}

/** Which app opens PDFs now, checked again whenever kobiPDF comes back to the front. */
export function usePdfHandler(): PdfHandler | null {
  const [handler, setHandler] = useState<PdfHandler | null>(null)
  const showNotice = useAppStore((s) => s.showNotice)

  useEffect(() => {
    if (!window.api.pdfHandler) return
    let cancelled = false
    let previous: PdfHandler['state'] | null = null
    const check = (chosen: boolean): void => {
      void window.api.pdfHandler?.().then((next) => {
        if (cancelled) return
        // Picking kobiPDF in the sheet (or clearing the other app and coming back) is confirmed once.
        if (next.state === 'default' && (chosen || (previous !== null && previous !== 'default'))) {
          showNotice({ kind: 'info', key: 'phone.defaultPdf.done' })
        } else if (chosen && next.state !== 'default') {
          // kobiPDF was picked "Just once".
          showNotice({ kind: 'info', key: 'phone.defaultPdf.onlyOnce' })
        }
        previous = next.state
        setHandler(next)
      })
    }
    check(false)
    // The sheet saves "Always" as it closes; a moment later the answer is certain.
    const off = window.api.onPdfHandlerChange?.((chosen) => window.setTimeout(() => check(chosen), chosen ? 400 : 0))
    return () => {
      cancelled = true
      off?.()
    }
  }, [showNotice])

  return handler
}

/** Shown on the welcome screen while PDFs do not open in kobiPDF. */
export function DefaultPdfCard(): JSX.Element | null {
  const { t } = useTranslation()
  const handler = usePdfHandler()
  const [hidden, setHidden] = useState(isDismissed)

  if (hidden || !handler || handler.state === 'default') return null

  const neverAsk = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Without storage the card simply comes back next launch.
    }
    setHidden(true)
  }

  const other = handler.state === 'other'
  return (
    <div role="status" className="mx-3 mt-3 rounded-lg border border-chrome-border bg-brand-soft p-3 text-[14px] text-ink">
      <div className="flex items-start gap-2">
        <FileCheck2 size={20} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            {other ? t('phone.defaultPdf.otherTitle', { app: handler.label }) : t('phone.defaultPdf.noneTitle')}
          </p>
          <p className="mt-1 text-ink-muted">{other ? t('phone.defaultPdf.otherBody') : t('phone.defaultPdf.noneBody')}</p>
        </div>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={() => setHidden(true)}
          className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-ink-muted active:bg-white"
        >
          <X size={18} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={neverAsk} className="rounded-md px-3 py-2 text-ink-muted active:bg-white">
          {t('defaultApp.neverAsk')}
        </button>
        <button
          type="button"
          onClick={() => takePdfHandlerStep(handler)}
          className="rounded-md bg-brand px-4 py-2 font-semibold text-white active:bg-brand-dark"
        >
          {other ? t('phone.defaultPdf.openSettings') : t('phone.defaultPdf.choose')}
        </button>
      </div>
    </div>
  )
}
