// Adım 0: MuPDF (WebAssembly) + pdf.js + pdf-lib telefonun WebView'ında çalışıyor mu, ne kadar sürüyor, bellek yetiyor mu?
// Masaüstündeki gerçek metin silme kodu (eraseText) aynen kullanılır.
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { eraseText } from '../../../src/renderer/src/editing/eraseText'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const logBox = $('log')
const started = performance.now()
let result: Uint8Array | null = null
let resultName = 'deneme.pdf'

function log(message: string): void {
  const line = `[${((performance.now() - started) / 1000).toFixed(1)} sn] ${message}`
  logBox.textContent += line + '\n'
  console.log('KOBIPDF', line)
}

function memory(): string {
  const m = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  return m ? `JS bellek ${(m.usedJSHeapSize / 1048576).toFixed(0)} / ${(m.jsHeapSizeLimit / 1048576).toFixed(0)} MB` : 'bellek ölçülemiyor'
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = performance.now()
  const value = await fn()
  log(`${label}: ${(performance.now() - t).toFixed(0)} ms, ${memory()}`)
  return value
}

window.addEventListener('securitypolicyviolation', (e) => log(`CSP ENGELİ: ${e.violatedDirective} ${e.blockedURI}`))
window.addEventListener('error', (e) => log(`HATA: ${e.message}`))
window.addEventListener('unhandledrejection', (e) => log(`HATA: ${String(e.reason)}`))

log(`Platform: ${Capacitor.getPlatform()}, ${navigator.userAgent}`)
log(`Çekirdek: ${navigator.hardwareConcurrency}, cihaz belleği: ${(navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? '?'} GB, ${memory()}`)

async function render(bytes: Uint8Array, canvas: HTMLCanvasElement): Promise<void> {
  const task = pdfjs.getDocument({ data: bytes.slice() })
  const pdf = await task.promise
  const page = await pdf.getPage(1)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: 600 / base.width })
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvas, viewport }).promise
  await task.destroy()
}

async function run(bytes: Uint8Array, name: string): Promise<void> {
  result = null
  $<HTMLButtonElement>('kaydet').disabled = true
  log(`--- ${name}, ${(bytes.length / 1048576).toFixed(2)} MB ---`)
  try {
    await timed('pdf.js ile ilk sayfayı çiz', () => render(bytes, $('once')))

    const task = pdfjs.getDocument({ data: bytes.slice() })
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const [x0, y0, x1, y1] = page.view
    const items = (await page.getTextContent()).items as { str: string; transform: number[]; width: number }[]
    const target = items.filter((it) => typeof it.str === 'string' && it.str.trim().length >= 4).sort((a, b) => b.str.length - a.str.length)[0]
    await task.destroy()
    if (!target) {
      log('İlk sayfada silinecek yazı yok (taranmış belge olabilir).')
      return
    }
    const h = Math.hypot(target.transform[2], target.transform[3])
    const baseline = y1 - target.transform[5]
    const x = target.transform[4] - x0
    log(`Silinecek yazı: "${target.str.trim()}" (${h.toFixed(1)} pt)`)

    const pageSizes = [{ width: x1 - x0, height: y1 - y0, baseWidth: x1 - x0, baseHeight: y1 - y0, rotation: 0, viewBox: [x0, y0, x1, y1] as [number, number, number, number] }]
    const rect = { x: x - 1, y: baseline - 0.8 * h - 1, width: target.width + 2, height: h + 2 }
    const erased = await timed('MuPDF ile eski yazıyı sil (ilk seferde WebAssembly yüklemesi dahil)', () => eraseText(bytes, [{ pageIndex: 0, rect }], pageSizes))
    if (!erased) {
      log('SONUÇ: MuPDF BAŞARISIZ (ayrıntı yukarıda ya da adb logcat içinde)')
      return
    }

    result = await timed('pdf-lib ile yeni yazıyı yaz ve kaydet', async () => {
      const doc = await PDFDocument.load(erased)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      doc.getPage(0).drawText('kobiPDF DENEME', { x: x0 + x, y: y1 - baseline, size: h, font, color: rgb(0.8, 0, 0) })
      return doc.save()
    })

    const checkTask = pdfjs.getDocument({ data: result.slice() })
    const check = await checkTask.promise
    const text = (await (await check.getPage(1)).getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ')
    await checkTask.destroy()
    const gone = !text.includes(target.str.trim())
    log(`Eski yazı dosyada kaldı mı: ${gone ? 'HAYIR (doğru)' : 'EVET (sorun)'}; yeni yazı var mı: ${text.includes('kobiPDF DENEME') ? 'evet' : 'HAYIR'}`)
    await timed('Sonucu çiz', () => render(result as Uint8Array, $('sonra')))
    resultName = name.replace(/\.pdf$/i, '') + '-deneme.pdf'
    $<HTMLButtonElement>('kaydet').disabled = false
    log(gone ? 'SONUÇ: BAŞARILI' : 'SONUÇ: SİLME ÇALIŞMADI')
  } catch (err) {
    log(`SONUÇ: HATA ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

$('ornek').addEventListener('click', async () => {
  const bytes = new Uint8Array(await (await fetch('./ornek.pdf')).arrayBuffer())
  await run(bytes, 'ornek.pdf')
})

$<HTMLInputElement>('dosya').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) await run(new Uint8Array(await file.arrayBuffer()), file.name)
})

$('kaydet').addEventListener('click', async () => {
  if (!result) return
  try {
    const written = await Filesystem.writeFile({
      path: `kobiPDF/${resultName}`,
      data: toBase64(result),
      directory: Directory.Documents,
      recursive: true
    })
    log(`Belgeler/kobiPDF klasörüne yazıldı: ${written.uri}`)
    await Share.share({ title: resultName, url: written.uri })
    log('Paylaş menüsü açıldı')
  } catch (err) {
    log(`Kaydet/Paylaş HATASI: ${err instanceof Error ? err.message : String(err)}`)
  }
})
