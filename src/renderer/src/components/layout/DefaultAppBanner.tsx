import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileCheck2, X } from 'lucide-react'

const DISMISS_KEY = 'kobipdf.defaultPrompt.dismissed'

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A slim bar asking to make kobiPDF the default PDF viewer. Windows does not
 * let apps set this themselves, so the button opens the Default apps settings.
 * The bar re-checks when the window regains focus and hides once kobiPDF is the default.
 */
export function DefaultAppBanner(): JSX.Element | null {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isDismissed()) return
    let cancelled = false
    const check = (): void => {
      void window.api.getDefaultPdfStatus().then((status) => {
        if (!cancelled) setVisible(status === 'notDefault' && !isDismissed())
      })
    }
    check()
    window.addEventListener('focus', check)
    return () => {
      cancelled = true
      window.removeEventListener('focus', check)
    }
  }, [])

  if (!visible) return null

  const neverAsk = (): void => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Without storage the bar simply comes back next launch.
    }
    setVisible(false)
  }

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-3 border-b border-chrome-border bg-brand-soft px-3 py-1.5 text-[12px] text-ink"
    >
      <FileCheck2 size={16} className="shrink-0 text-brand" />
      <span className="min-w-0 flex-1">{t('defaultApp.message')}</span>
      <button
        type="button"
        onClick={() => void window.api.openDefaultAppsSettings()}
        className="rounded bg-brand px-3 py-1 font-semibold text-white hover:bg-brand-dark"
      >
        {t('defaultApp.makeDefault')}
      </button>
      <button type="button" onClick={neverAsk} className="rounded px-2 py-1 text-ink-muted hover:bg-white">
        {t('defaultApp.neverAsk')}
      </button>
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={() => setVisible(false)}
        className="rounded p-1 text-ink-muted hover:bg-white"
      >
        <X size={14} />
      </button>
    </div>
  )
}
