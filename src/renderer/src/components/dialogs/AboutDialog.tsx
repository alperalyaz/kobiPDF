import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ExternalLink, HelpCircle, Info, Keyboard, ListOrdered } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import arimoLicense from '@expo-google-fonts/arimo/LICENSE_FONT?raw'
import tinosLicense from '@expo-google-fonts/tinos/LICENSE_FONT?raw'
import cousineLicense from '@expo-google-fonts/cousine/LICENSE_FONT?raw'
import carlitoLicense from '@expo-google-fonts/carlito/LICENSE_FONT?raw'
import gelasioLicense from '@expo-google-fonts/gelasio/LICENSE_FONT?raw'
import logoFull from '../../assets/logo-full.svg'
import { actions, type ActionDef } from '../../actions/actions'
import { formatShortcut } from '../common/ActionButton'
import { DialogButton, Modal } from './Modal'
import { takePdfHandlerStep, usePdfHandler } from '../phone/DefaultPdfCard'

const VERSION = __APP_VERSION__
const REPO_URL = 'https://github.com/alperalyaz/kobiPDF'
const ISSUES_URL = `${REPO_URL}/issues`
const WEBSITE_URL = 'https://www.hidroteknik.si'
/** Also given to Google Play and the Microsoft Store; Play requires a link inside the app too. */
const PRIVACY_URL = `${REPO_URL}/blob/main/PRIVACY.md`

type TabId = 'general' | 'howto' | 'shortcuts' | 'faq' | 'company'

const TABS: { id: TabId; icon: LucideIcon }[] = [
  { id: 'general', icon: Info },
  { id: 'howto', icon: ListOrdered },
  { id: 'shortcuts', icon: Keyboard },
  { id: 'faq', icon: HelpCircle },
  { id: 'company', icon: Building2 }
]

/** Full license texts of the bundled stand-in fonts (copyright line + SIL OFL 1.1). */
const FONT_LICENSES = [arimoLicense, tinosLicense, cousineLicense, carlitoLicense, gelasioLicense]

const HOWTO_STEPS =['open', 'navigate', 'text', 'markup', 'signature', 'pages', 'save'] as const
const PHONE_HOWTO_STEPS = ['open', 'navigate', 'text', 'signature', 'save'] as const
const FAQ_ITEMS = ['free', 'offline', 'default', 'scanned', 'encrypted', 'undo', 'bug'] as const

/** Third-party components shipped inside the app, with their licenses. */
const THIRD_PARTY: [name: string, license: string][] = [
  ...((__ANDROID__
    ? [
        ['Capacitor', 'MIT'],
        ['AndroidX', 'Apache-2.0']
      ]
    : [['Electron', 'MIT']]) as [string, string][]),
  ['React', 'MIT'],
  ['PDF.js (pdfjs-dist)', 'Apache-2.0'],
  ['pdf-lib, @pdf-lib/fontkit', 'MIT'],
  ['MuPDF.js', 'AGPL-3.0'],
  ['DejaVu Fonts', 'Bitstream Vera / Public Domain'],
  ['Arimo, Tinos, Cousine, Carlito, Gelasio', 'SIL OFL 1.1'],
  ['Lucide Icons', 'ISC'],
  ['i18next, react-i18next', 'MIT'],
  ['Zustand', 'MIT']
]

/** One row per command: actions that share a label (e.g. Redo: Ctrl+Y and Ctrl+Shift+Z) are merged. */
function shortcutRows(): { labelKey: string; keys: string[] }[] {
  const rows = new Map<string, string[]>()
  for (const action of Object.values(actions) as ActionDef[]) {
    if (!action.shortcut) continue
    const keys = rows.get(action.labelKey) ?? []
    keys.push(action.shortcut)
    rows.set(action.labelKey, keys)
  }
  return [...rows].map(([labelKey, keys]) => ({ labelKey, keys }))
}

function ExternalLinkRow({ href, label, detail }: { href: string; label: string; detail: string }): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between rounded border border-chrome-border px-3 py-2 hover:bg-chrome"
    >
      <span>
        <span className="block font-medium text-ink">{label}</span>
        <span className="block text-[11px] text-ink-muted">{detail}</span>
      </span>
      <ExternalLink size={14} className="shrink-0 text-brand" />
    </a>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <section className="mb-4">
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      {children}
    </section>
  )
}

function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return (
    <kbd className="rounded border border-chrome-border bg-chrome px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {children}
    </kbd>
  )
}

export function AboutDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<TabId>('general')

  // On the phone the tabs sit in a scrolling row above the content, and keyboard shortcuts are left out.
  const phone = __ANDROID__
  const tabs = phone ? TABS.filter((item) => item.id !== 'shortcuts') : TABS
  const pdfHandler = usePdfHandler()
  const howtoSteps = phone ? PHONE_HOWTO_STEPS : HOWTO_STEPS
  // Phone wording lives under about.phone.*; anything not rewritten there uses the desktop text.
  const tx = (key: string): string =>
    phone && i18n.exists(key.replace(/^about\./, 'about.phone.')) ? t(key.replace(/^about\./, 'about.phone.')) : t(key)

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const forward = phone ? 'ArrowRight' : 'ArrowDown'
    const back = phone ? 'ArrowLeft' : 'ArrowUp'
    if (event.key !== forward && event.key !== back) return
    event.preventDefault()
    const index = tabs.findIndex((item) => item.id === tab)
    const next = tabs[(index + (event.key === forward ? 1 : tabs.length - 1)) % tabs.length]
    setTab(next.id)
    document.getElementById(`about-tab-${next.id}`)?.focus()
  }

  return (
    <Modal
      title={t('app.aboutTitle')}
      width={760}
      onCancel={onClose}
      footer={
        <DialogButton variant="primary" autoFocus onClick={onClose}>
          {t('common.close')}
        </DialogButton>
      }
    >
      <div className={phone ? '-mx-4 -my-3 flex h-[70vh] flex-col' : '-mx-4 -my-3 flex h-[480px] max-h-[70vh]'}>
        <div
          role="tablist"
          aria-orientation={phone ? 'horizontal' : 'vertical'}
          className={
            phone
              ? 'flex shrink-0 gap-1 overflow-x-auto border-b border-chrome-border bg-chrome p-2'
              : 'flex w-[190px] shrink-0 flex-col gap-0.5 border-r border-chrome-border bg-chrome p-2'
          }
        >
          {tabs.map(({ id, icon: Icon }) => (
            <button
              key={id}
              id={`about-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={tab === id}
              tabIndex={tab === id ? 0 : -1}
              onClick={(event) => {
                setTab(id)
                // A tab half hidden at the edge of the phone's scrolling row slides fully into view.
                if (phone) event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
              }}
              onKeyDown={onTabKeyDown}
              className={`flex items-center gap-2 rounded px-2.5 py-2 text-left text-[12px] ${phone ? 'shrink-0 whitespace-nowrap' : ''} ${
                tab === id ? 'bg-white font-semibold text-brand shadow-sm' : 'text-ink hover:bg-white/70'
              }`}
            >
              <Icon size={15} />
              {t(`about.tabs.${id}`)}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          className={`min-h-0 flex-1 overflow-y-auto ${phone ? 'px-4' : 'px-5'} py-4 text-[12px] leading-relaxed text-ink`}
        >
          {tab === 'general' && (
            <>
              <div className={phone ? 'flex flex-col items-center gap-1' : 'flex items-center gap-4'}>
                <img src={logoFull} alt={t('app.name')} className={phone ? 'h-24 w-auto' : 'h-28 w-auto'} draggable={false} />
                <p className="text-[13px] font-semibold text-ink-muted">{t('about.version', { version: VERSION })}</p>
              </div>
              <p className="mt-3">{t('app.tagline')}</p>
              <p className="mt-2 text-ink-muted">{phone ? t('about.phone.aboutText') : t('app.aboutText')}</p>
              <div className="mt-4 flex flex-col gap-2">
                <ExternalLinkRow href={REPO_URL} label={t('about.links.repo')} detail="github.com/alperalyaz/kobiPDF" />
                <ExternalLinkRow href={ISSUES_URL} label={t('about.links.issues')} detail={t('about.links.issuesDetail')} />
                <ExternalLinkRow href={WEBSITE_URL} label={t('about.links.website')} detail="www.hidroteknik.si" />
                <ExternalLinkRow href={PRIVACY_URL} label={t('about.links.privacy')} detail={t('about.links.privacyDetail')} />
                {phone && pdfHandler && (
                  <button
                    type="button"
                    disabled={pdfHandler.state === 'default'}
                    onClick={() => takePdfHandlerStep(pdfHandler)}
                    className="flex items-center justify-between rounded border border-chrome-border px-3 py-2 text-left hover:bg-chrome disabled:hover:bg-transparent"
                  >
                    <span>
                      <span className="block font-medium text-ink">{t('phone.defaultPdf.aboutRow')}</span>
                      <span className="block text-[11px] text-ink-muted">
                        {pdfHandler.state === 'default'
                          ? t('phone.defaultPdf.aboutDefault')
                          : pdfHandler.state === 'other'
                            ? t('phone.defaultPdf.aboutOther', { app: pdfHandler.label })
                            : t('phone.defaultPdf.aboutNone')}
                      </span>
                    </span>
                    {pdfHandler.state === 'default' ? (
                      <Check size={14} className="shrink-0 text-brand" />
                    ) : (
                      <ExternalLink size={14} className="shrink-0 text-brand" />
                    )}
                  </button>
                )}
                {window.api.platform === 'win32' && (
                  <button
                    type="button"
                    onClick={() => void window.api.openDefaultAppsSettings()}
                    className="flex items-center justify-between rounded border border-chrome-border px-3 py-2 text-left hover:bg-chrome"
                  >
                    <span>
                      <span className="block font-medium text-ink">{t('defaultApp.makeDefault')}</span>
                      <span className="block text-[11px] text-ink-muted">{t('about.links.defaultDetail')}</span>
                    </span>
                    <ExternalLink size={14} className="shrink-0 text-brand" />
                  </button>
                )}
              </div>
            </>
          )}

          {tab === 'howto' && (
            <ol className="flex flex-col gap-3">
              {howtoSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span>
                    <span className="block font-semibold">{tx(`about.howto.${step}.title`)}</span>
                    <span className="block text-ink-muted">{tx(`about.howto.${step}.body`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {tab === 'shortcuts' && !phone && (
            <table className="w-full border-collapse">
              <tbody>
                {shortcutRows().map(({ labelKey, keys }) => (
                  <tr key={labelKey} className="border-b border-chrome-border last:border-0">
                    <td className="py-1.5 pr-3">{t(labelKey)}</td>
                    <td className="py-1.5 text-right">
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {keys.map((key) => (
                          <Kbd key={key}>{formatShortcut(key)}</Kbd>
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5 pr-3">{t('about.shortcuts.wheelZoom')}</td>
                  <td className="py-1.5 text-right">
                    <Kbd>{formatShortcut('Ctrl')} + {t('about.shortcuts.wheel')}</Kbd>
                  </td>
                </tr>
              </tbody>
            </table>
          )}

          {tab === 'faq' && (
            <div className="flex flex-col gap-3">
              {FAQ_ITEMS.map((item) => (
                <div key={item}>
                  <p className="font-semibold">{tx(`about.faq.${item}.q`)}</p>
                  <p className="text-ink-muted">{tx(`about.faq.${item}.a`)}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'company' && (
            <>
              <Section title={t('app.developer')}>
                <p className="text-[14px] font-semibold">Hidroteknik A.Ş.</p>
                <p className="mt-1">{t('about.company.body')}</p>
                <a href={WEBSITE_URL} target="_blank" rel="noreferrer" className="mt-1 inline-block text-brand hover:underline">
                  www.hidroteknik.si
                </a>
              </Section>
              <Section title={t('about.company.licenseTitle')}>
                <p>{t('about.company.license')}</p>
                <p className="mt-1 text-ink-muted">{t('app.rights', { year: new Date().getFullYear() })}</p>
              </Section>
              <Section title={t('about.company.thirdParty')}>
                <table className="w-full border-collapse">
                  <tbody>
                    {THIRD_PARTY.map(([name, license]) => (
                      <tr key={name} className="border-b border-chrome-border last:border-0">
                        <td className="py-1 pr-3">{name}</td>
                        <td className="py-1 text-right text-ink-muted">{license}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* SIL OFL 1.1 asks for the copyright notice and license text to travel with the fonts. */}
                <details className="mt-2">
                  <summary className="cursor-pointer text-brand">{t('about.company.fontLicenses')}</summary>
                  {FONT_LICENSES.map((text, i) => (
                    <pre key={i} className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-chrome p-2 text-[10px] leading-snug">
                      {text}
                    </pre>
                  ))}
                </details>
              </Section>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
