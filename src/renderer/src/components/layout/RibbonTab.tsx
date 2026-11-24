import { useTranslation } from 'react-i18next'
import type { RibbonTabConfig } from '../../actions/ribbonConfig'

interface RibbonTabProps {
  tab: RibbonTabConfig
  selected: boolean
  onSelect: () => void
}

export function RibbonTab({ tab, selected, onSelect }: RibbonTabProps): JSX.Element {
  const { t } = useTranslation()
  const isFile = tab.id === 'file'

  const tone = isFile
    ? selected
      ? 'bg-accent-dark text-white'
      : 'bg-accent text-white hover:bg-accent-dark'
    : selected
      ? 'border-chrome-border border-b-chrome bg-chrome font-semibold text-brand shadow-[inset_0_2px_0_var(--color-accent)]'
      : 'border-transparent text-ink hover:bg-chrome/70'

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`relative -mb-px h-7 rounded-t border px-4 text-[12px] ${isFile ? 'border-transparent' : ''} ${tone}`}
    >
      {t(tab.labelKey)}
    </button>
  )
}
