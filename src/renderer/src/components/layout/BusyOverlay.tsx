import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useBackHandler } from '../../platform/back'
import { useAppStore } from '../../store/useAppStore'

/**
 * Covers the whole window while a document opens or saves, so nothing (Save, Share, the page) can be
 * tapped twice meanwhile.
 */
export function BusyOverlay(): JSX.Element | null {
  const { t } = useTranslation()
  const loading = useAppStore((s) => s.loading)
  const busy = useAppStore((s) => s.busy)
  const shown = loading || busy !== null
  // Back does nothing while saving; leaving mid-save could lose the file.
  useBackHandler(shown, () => true)
  if (!shown) return null
  return (
    <div className="no-drag fixed inset-0 z-[950] flex items-center justify-center bg-workspace/70" role="status">
      <div className="flex items-center gap-2 rounded-md bg-white px-4 py-3 shadow">
        <LoaderCircle size={18} className="animate-spin text-brand" />
        <span>{t(busy ?? 'common.loading')}</span>
      </div>
    </div>
  )
}
