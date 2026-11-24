import { FolderOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { runAction } from '../../actions/actions'
import logoFull from '../../assets/logo-full.svg'
import { formatShortcut } from '../common/ActionButton'

export function EmptyState(): JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex w-[340px] flex-col items-center rounded-lg border border-chrome-border bg-white px-8 py-10 text-center shadow-sm">
        <h1>
          <img src={logoFull} alt={t('app.name')} className="h-40 w-auto" draggable={false} />
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{t('app.tagline')}</p>
        <p className="mt-3 text-[12px] text-ink-muted">{t('common.openHint')}</p>
        <button
          type="button"
          onClick={() => runAction('open')}
          className="mt-6 inline-flex items-center gap-2 rounded bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-brand-dark"
        >
          <FolderOpen size={16} />
          {t('common.openButton')}
          <span className="text-[11px] font-normal opacity-80">{formatShortcut('Ctrl+O')}</span>
        </button>
      </div>
    </div>
  )
}
