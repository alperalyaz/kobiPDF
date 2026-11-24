import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DialogButton, Modal } from './Modal'
import { closeDialog } from './dialogStore'

const MM_TO_PT = 72 / 25.4
const MIN_MM = 10
const MAX_MM = 5000

type PresetId = 'a4Portrait' | 'a4Landscape' | 'a5Portrait' | 'a5Landscape' | 'custom'

/** Paper sizes in millimetres (width x height). */
const PRESETS: { id: Exclude<PresetId, 'custom'>; width: number; height: number }[] = [
  { id: 'a4Portrait', width: 210, height: 297 },
  { id: 'a4Landscape', width: 297, height: 210 },
  { id: 'a5Portrait', width: 148, height: 210 },
  { id: 'a5Landscape', width: 210, height: 148 }
]

/** Small outline of the page shape, scaled to fit a 40px box. */
function PagePreview({ width, height }: { width: number; height: number }): JSX.Element {
  const scale = 40 / Math.max(width, height)
  return (
    <span className="flex h-11 w-11 items-center justify-center">
      <span
        className="block rounded-[2px] border border-ink-muted bg-white"
        style={{ width: width * scale, height: height * scale }}
      />
    </span>
  )
}

function parseMm(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return Number.isFinite(n) && n >= MIN_MM && n <= MAX_MM ? n : null
}

export function NewDocumentDialog(): JSX.Element {
  const { t } = useTranslation()
  const [preset, setPreset] = useState<PresetId>('a4Portrait')
  const [customWidth, setCustomWidth] = useState('210')
  const [customHeight, setCustomHeight] = useState('297')

  const chosen = PRESETS.find((p) => p.id === preset)
  const widthMm = chosen ? chosen.width : parseMm(customWidth)
  const heightMm = chosen ? chosen.height : parseMm(customHeight)
  const valid = widthMm !== null && heightMm !== null

  const submit = (): void => {
    if (widthMm === null || heightMm === null) return
    closeDialog({ width: widthMm * MM_TO_PT, height: heightMm * MM_TO_PT })
  }

  const option = (id: PresetId, width: number, height: number, detail: string): JSX.Element => (
    <button
      key={id}
      type="button"
      role="radio"
      aria-checked={preset === id}
      onClick={() => setPreset(id)}
      onDoubleClick={id === 'custom' ? undefined : submit}
      className={`flex flex-col items-center gap-1 rounded border px-2 py-2 ${
        preset === id ? 'border-brand bg-brand-soft' : 'border-chrome-border hover:bg-chrome'
      }`}
    >
      <PagePreview width={width} height={height} />
      <span className="font-medium text-ink">{t(`dialogs.newDocument.${id}`)}</span>
      <span className="text-[11px] text-ink-muted">{detail}</span>
    </button>
  )

  const customPreviewW = parseMm(customWidth) ?? 210
  const customPreviewH = parseMm(customHeight) ?? 297

  return (
    <Modal
      title={t('dialogs.newDocument.title')}
      width={520}
      onCancel={() => closeDialog(null)}
      footer={
        <>
          <DialogButton onClick={() => closeDialog(null)}>{t('common.cancel')}</DialogButton>
          <DialogButton variant="primary" autoFocus disabled={!valid} onClick={submit}>
            {t('dialogs.newDocument.create')}
          </DialogButton>
        </>
      }
    >
      <p className="mb-3 text-ink-muted">{t('dialogs.newDocument.hint')}</p>
      <div role="radiogroup" className="grid grid-cols-5 gap-2">
        {PRESETS.map((p) => option(p.id, p.width, p.height, `${p.width} × ${p.height} mm`))}
        {option('custom', customPreviewW, customPreviewH, t('dialogs.newDocument.customDetail'))}
      </div>
      {preset === 'custom' && (
        <form
          className="mt-3 flex items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          {(
            [
              ['width', customWidth, setCustomWidth],
              ['height', customHeight, setCustomHeight]
            ] as const
          ).map(([field, value, setValue]) => (
            <label key={field} className="flex flex-col gap-1">
              <span>{t(`dialogs.newDocument.${field}`)}</span>
              <span className="flex items-center gap-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  aria-invalid={parseMm(value) === null}
                  className="w-24 rounded border border-chrome-border px-2 py-1 outline-none focus:border-brand aria-[invalid=true]:border-accent"
                />
                <span className="text-ink-muted">mm</span>
              </span>
            </label>
          ))}
          <button type="submit" hidden />
        </form>
      )}
      {preset === 'custom' && !valid && (
        <p className="mt-2 text-[11px] text-accent">{t('dialogs.newDocument.invalid', { min: MIN_MM, max: MAX_MM })}</p>
      )}
    </Modal>
  )
}
