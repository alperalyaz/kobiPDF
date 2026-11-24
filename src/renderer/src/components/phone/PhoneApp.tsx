// The phone layout (Android build only). The viewer, editing layers, dialogs and file handling are the
// desktop ones; only the chrome around them differs: a top bar, a context bar for what is being edited,
// and a bottom bar with the three phone modes (View, Text, Sign).
import { useEffect, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  Eye,
  FileX,
  FolderOpen,
  Info,
  Maximize2,
  MoreVertical,
  PenLine,
  Stamp,
  Trash2,
  Type,
  TypeOutline
} from 'lucide-react'
import { getAction, isActionEnabled, runAction, type ActionId } from '../../actions/actions'
import logo from '../../assets/logo.png'
import { commitDraft } from '../../editing/draft'
import { isDirty, useBothStores } from '../../editing/history'
import { setLanguage } from '../../locales/i18n'
import { useBackHandler } from '../../platform/back'
import { useAppStore } from '../../store/useAppStore'
import { useEditStore } from '../../store/useEditStore'
import { AboutDialog } from '../dialogs/AboutDialog'
import { DialogHost } from '../dialogs/DialogHost'
import { BusyOverlay } from '../layout/BusyOverlay'
import { NoticeBar } from '../layout/NoticeBar'
import { PropertiesBar } from '../layout/PropertiesBar'
import { EmptyState } from '../viewer/EmptyState'
import { PdfViewer } from '../viewer/PdfViewer'

const TEXT_TOOLS = new Set(['editText', 'addText'])

/** True while the on-screen keyboard is up (a text field has focus and the window shrank). */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let tallest = window.innerHeight
    const check = (): void => {
      tallest = Math.max(tallest, window.innerHeight)
      const el = document.activeElement
      const typing =
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLInputElement && !['range', 'checkbox', 'color', 'button'].includes(el.type))
      setOpen(typing && window.innerHeight < tallest * 0.8)
    }
    const later = (): void => {
      window.setTimeout(check, 100)
    }
    window.addEventListener('resize', check)
    window.addEventListener('focusin', later)
    window.addEventListener('focusout', later)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('focusin', later)
      window.removeEventListener('focusout', later)
    }
  }, [])
  return open
}

function blurTyping(): void {
  const el = document.activeElement
  if (el instanceof HTMLElement) el.blur()
}

/** A top-bar button bound to a desktop action (same enabled rules, same handler). */
function TopAction({ id }: { id: ActionId }): JSX.Element {
  const { t } = useTranslation()
  const action = getAction(id)
  const enabled = useBothStores((s, e) => isActionEnabled(id, s, e))
  const Icon = action.icon
  return (
    <button
      type="button"
      aria-label={t(action.labelKey)}
      disabled={!enabled}
      onClick={() => runAction(id)}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-chrome disabled:opacity-30"
    >
      <Icon size={22} />
    </button>
  )
}

function BarButton({
  icon,
  label,
  onClick,
  tone = 'default'
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'primary' | 'danger'
}): JSX.Element {
  const colors =
    tone === 'primary'
      ? 'bg-brand text-white active:bg-brand-dark'
      : tone === 'danger'
        ? 'border border-accent text-accent active:bg-accent-soft'
        : 'border border-chrome-border bg-white text-ink active:bg-chrome'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium ${colors}`}
    >
      {icon}
      {label}
    </button>
  )
}

/** A sheet sliding up from the bottom (menu, signature choice). Tapping outside or Back closes it. */
function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }): JSX.Element {
  useBackHandler(true, onClose)
  return (
    <div className="fixed inset-0 z-[800] flex flex-col justify-end bg-black/30" onClick={onClose} role="presentation">
      <div
        className="rounded-t-2xl bg-white px-2 pb-4 pt-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-chrome-border" />
        {children}
      </div>
    </div>
  )
}

function SheetItem({
  icon,
  label,
  onClick,
  disabled = false
}: {
  icon: ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex h-13 w-full items-center gap-4 rounded-lg px-4 text-left text-[15px] text-ink active:bg-chrome disabled:opacity-30"
    >
      <span className="text-ink-muted">{icon}</span>
      {label}
    </button>
  )
}

function PageIndicator(): JSX.Element | null {
  const page = useAppStore((s) => s.currentPage)
  const total = useAppStore((s) => s.document?.pageSizes.length ?? 0)
  if (total === 0) return null
  return (
    <div className="pointer-events-none absolute right-3 top-2 z-30 rounded-full bg-ink/70 px-2.5 py-0.5 text-[12px] tabular-nums text-white">
      {page} / {total}
    </div>
  )
}

export function PhoneApp(): JSX.Element {
  const { t, i18n } = useTranslation()
  const doc = useAppStore((s) => s.document)
  const activeDocumentId = useAppStore((s) => s.activeDocumentId)
  const tool = useAppStore((s) => s.activeTool)
  const dirty = useBothStores((s, e) => isDirty(s, e))
  const draft = useEditStore((s) => s.draft)
  const selectedId = useEditStore((s) => s.selectedId)
  const keyboardOpen = useKeyboardOpen()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)
  const textMode = TEXT_TOOLS.has(tool)

  useEffect(() => {
    document.documentElement.classList.add('android')
  }, [])

  // Back, innermost first (the most recently activated handler wins): finish the text being edited,
  // then drop the selection, then leave Text mode.
  useBackHandler(textMode, () => {
    useAppStore.getState().setActiveTool('select')
  })
  useBackHandler(selectedId !== null, () => {
    useEditStore.getState().select(null)
  })
  useBackHandler(draft !== null, () => {
    commitDraft()
    blurTyping()
  })

  const setMode = (mode: 'view' | 'text'): void => {
    commitDraft()
    useEditStore.getState().select(null)
    useAppStore.getState().setActiveTool(mode === 'text' ? 'editText' : 'select')
  }

  const done = (): void => {
    commitDraft()
    blurTyping()
    useEditStore.getState().select(null)
  }

  // Buttons in the context bar must not take focus from the text box (that would close the keyboard).
  const keepFocus = (e: ReactMouseEvent): void => {
    if ((e.target as HTMLElement).closest('button')) e.preventDefault()
  }

  let context: ReactNode = null
  if (doc && draft) {
    context = (
      <>
        <div className="min-w-0 flex-1 overflow-x-auto" style={{ zoom: 1.25 }}>
          <PropertiesBar />
        </div>
        <BarButton icon={<Check size={18} />} label={t('phone.done')} tone="primary" onClick={done} />
      </>
    )
  } else if (doc && selectedId) {
    context = (
      <>
        <div className="min-w-0 flex-1 overflow-x-auto" style={{ zoom: 1.25 }}>
          <PropertiesBar />
        </div>
        <BarButton icon={<Trash2 size={18} />} label={t('phone.delete')} tone="danger" onClick={() => runAction('deleteObject')} />
        <BarButton icon={<Check size={18} />} label={t('phone.done')} tone="primary" onClick={done} />
      </>
    )
  } else if (doc && textMode) {
    context = (
      <>
        <span className="min-w-0 flex-1 px-2 text-[13px] leading-tight text-ink-muted">
          {t(tool === 'addText' ? 'phone.addHint' : 'phone.editHint')}
        </span>
        <BarButton
          icon={<TypeOutline size={18} />}
          label={t(tool === 'addText' ? 'phone.fixText' : 'phone.newText')}
          tone={tool === 'addText' ? 'primary' : 'default'}
          onClick={() => useAppStore.getState().setActiveTool(tool === 'addText' ? 'editText' : 'addText')}
        />
      </>
    )
  }

  const tab = (mode: 'view' | 'text' | 'sign', icon: ReactNode, label: string, active: boolean, onClick: () => void): JSX.Element => (
    <button
      key={mode}
      type="button"
      disabled={!doc}
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[12px] disabled:opacity-30 ${active ? 'text-brand' : 'text-ink-muted'}`}
    >
      <span className={`flex h-7 w-14 items-center justify-center rounded-full ${active ? 'bg-brand-soft' : ''}`}>{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="flex h-full flex-col bg-workspace">
      {/* While typing, the keyboard needs the room (in landscape nothing else would fit); Done is in the context bar. */}
      <header
        className={`h-14 shrink-0 items-center gap-0.5 border-b border-chrome-border bg-white pl-3 pr-1 ${keyboardOpen ? 'hidden' : 'flex'}`}
      >
        <img src={logo} alt="" className="size-7 shrink-0" draggable={false} />
        <div className="min-w-0 flex-1 truncate pl-2 text-[15px] font-semibold text-ink">
          {doc ? (
            `${dirty ? '* ' : ''}${doc.name}`
          ) : (
            <span className="text-brand">
              kobi<span className="text-accent">PDF</span>
            </span>
          )}
        </div>
        <TopAction id="undo" />
        <TopAction id="save" />
        <TopAction id="share" />
        <button
          type="button"
          aria-label={t('phone.menu')}
          onClick={() => setMenuOpen(true)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-chrome"
        >
          <MoreVertical size={22} />
        </button>
      </header>

      <main className="relative min-h-0 flex-1">
        {doc ? <PdfViewer key={activeDocumentId ?? doc.name} doc={doc} /> : <EmptyState />}
        {!keyboardOpen && <PageIndicator />}
        <NoticeBar />
      </main>

      {context && (
        <div
          className="flex shrink-0 items-center gap-2 border-t border-chrome-border bg-chrome px-2 py-1.5"
          onMouseDown={keepFocus}
        >
          {context}
        </div>
      )}

      {!keyboardOpen && (
        <nav className="flex h-16 shrink-0 border-t border-chrome-border bg-white">
          {tab('view', <Eye size={20} />, t('phone.view'), !textMode, () => setMode('view'))}
          {tab('text', <Type size={20} />, t('phone.text'), textMode, () => setMode('text'))}
          {tab('sign', <PenLine size={20} />, t('phone.sign'), false, () => {
            commitDraft()
            setSignOpen(true)
          })}
        </nav>
      )}

      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)}>
          <SheetItem
            icon={<FolderOpen size={20} />}
            label={t('tools.open')}
            onClick={() => {
              setMenuOpen(false)
              runAction('open')
            }}
          />
          <SheetItem
            icon={<Maximize2 size={20} />}
            label={t('tools.fitWidth')}
            disabled={!doc}
            onClick={() => {
              setMenuOpen(false)
              runAction('fitWidth')
            }}
          />
          <SheetItem
            icon={<FileX size={20} />}
            label={t('tools.close')}
            disabled={!doc}
            onClick={() => {
              setMenuOpen(false)
              runAction('close')
            }}
          />
          <SheetItem
            icon={<Info size={20} />}
            label={t('app.aboutTitle')}
            onClick={() => {
              setMenuOpen(false)
              setAboutOpen(true)
            }}
          />
          <div className="flex items-center gap-4 px-4 pt-2">
            <span className="flex-1 text-[15px] text-ink">{t('phone.language')}</span>
            {(['tr', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`h-10 w-14 rounded-full text-[14px] font-semibold ${i18n.language === lang ? 'bg-brand text-white' : 'border border-chrome-border text-ink'}`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {signOpen && (
        <Sheet onClose={() => setSignOpen(false)}>
          <SheetItem
            icon={<PenLine size={20} />}
            label={t('phone.drawSignature')}
            onClick={() => {
              setSignOpen(false)
              runAction('drawSignature')
            }}
          />
          <SheetItem
            icon={<Stamp size={20} />}
            label={t('phone.uploadStamp')}
            onClick={() => {
              setSignOpen(false)
              runAction('imageSignature')
            }}
          />
        </Sheet>
      )}

      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      <DialogHost />
      <BusyOverlay />
    </div>
  )
}
