import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { formatBytes } from './utils'

export const PDF_MAX_BYTES = 25 * 1024 * 1024
export const PDF_MAX_PAGES = 80
export const PDF_ACCEPT = 'application/pdf,.pdf'

let workerReady = false

export function setupPdfJsWorker() {
  if (workerReady) return
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()
  workerReady = true
}

export function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function assertPdfFile(file: File, maxBytes = PDF_MAX_BYTES) {
  if (!isPdfFile(file)) throw new Error('請上傳 PDF 檔案')
  if (file.size > maxBytes) throw new Error(`檔案過大（上限 ${formatBytes(maxBytes)}）`)
}

export async function loadPdfLib(file: File, maxPages = PDF_MAX_PAGES) {
  assertPdfFile(file)
  const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
  const n = doc.getPageCount()
  if (n > maxPages) throw new Error(`頁數過多（上限 ${maxPages} 頁，目前 ${n} 頁）`)
  return doc
}

export async function loadPdfJs(file: File, maxPages = PDF_MAX_PAGES) {
  setupPdfJsWorker()
  assertPdfFile(file)
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data }).promise
  if (pdf.numPages > maxPages) {
    await pdf.destroy()
    throw new Error(`頁數過多（上限 ${maxPages} 頁，目前 ${pdf.numPages} 頁）`)
  }
  return pdf
}

/** Render Unicode text to PNG bytes (for embedding via pdf-lib). */
export async function textToPngBytes(
  text: string,
  opts: {
    fontSize?: number
    color?: string
    padding?: number
    maxWidth?: number
    italic?: boolean
  } = {},
) {
  const fontSize = opts.fontSize ?? 28
  const padding = opts.padding ?? 12
  const color = opts.color ?? '#222222'
  const maxWidth = opts.maxWidth ?? 900
  const italic = opts.italic ? 'italic ' : ''

  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `${italic}600 ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  const metrics = measure.measureText(text)
  const textW = Math.min(maxWidth, Math.ceil(metrics.width) + 4)
  const width = textW + padding * 2
  const height = Math.ceil(fontSize * 1.4) + padding * 2

  const c = document.createElement('canvas')
  c.width = Math.max(1, width)
  c.height = Math.max(1, height)
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.fillStyle = color
  ctx.font = `${italic}600 ${fontSize}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, c.width / 2, c.height / 2, maxWidth)

  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('文字影像產生失敗')
  return new Uint8Array(await blob.arrayBuffer())
}

/** Diagonal tiled watermark PNG covering roughly page size. */
export async function watermarkTilePngBytes(
  text: string,
  opts: {
    pageW: number
    pageH: number
    fontSize: number
    angle: number
    color: string
    opacity: number
  },
) {
  const scale = 2
  const w = Math.max(1, Math.round(opts.pageW * scale))
  const h = Math.max(1, Math.round(opts.pageH * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.globalAlpha = Math.max(0.05, Math.min(0.8, opts.opacity))
  ctx.fillStyle = opts.color
  ctx.font = `600 ${Math.round(opts.fontSize * scale)}px "Noto Sans TC", "Microsoft JhengHei", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(w / 2, h / 2)
  ctx.rotate((opts.angle * Math.PI) / 180)
  const gap = Math.max(120, opts.fontSize * 5) * scale
  const diag = Math.sqrt(w * w + h * h)
  for (let y = -diag; y < diag; y += gap) {
    for (let x = -diag; x < diag; x += gap) ctx.fillText(text, x, y)
  }
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'))
  if (!blob) throw new Error('浮水印影像失敗')
  return new Uint8Array(await blob.arrayBuffer())
}

/** 0-based page index → object URL */
export type PdfThumbMap = Record<number, string>

export function revokePdfThumbs(thumbs: PdfThumbMap) {
  for (const url of Object.values(thumbs)) URL.revokeObjectURL(url)
}

/** Render page thumbnails with pdf.js. Caller must revoke URLs when done. */
export async function renderPdfPageThumbs(
  data: Uint8Array,
  opts: {
    pageCount: number
    scale?: number
    isCancelled?: () => boolean
    onProgress?: (page: number, total: number) => void
  },
): Promise<PdfThumbMap> {
  setupPdfJsWorker()
  const pdf = await pdfjs.getDocument({ data }).promise
  const next: PdfThumbMap = {}
  const n = Math.min(opts.pageCount, pdf.numPages)
  const scale = opts.scale ?? 0.22
  try {
    for (let p = 1; p <= n; p++) {
      if (opts.isCancelled?.()) {
        revokePdfThumbs(next)
        return {}
      }
      opts.onProgress?.(p, n)
      try {
        const page = await pdf.getPage(p)
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        await page.render({ canvasContext: ctx, viewport }).promise
        if (opts.isCancelled?.()) {
          revokePdfThumbs(next)
          return {}
        }
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) next[p - 1] = URL.createObjectURL(blob)
      } catch {
        /* skip failed page */
      }
    }
  } finally {
    await pdf.destroy().catch(() => undefined)
  }
  return next
}

/** First-page thumb for each file (merge preview). */
export async function renderPdfFirstPageThumbs(
  files: File[],
  opts: { scale?: number; isCancelled?: () => boolean } = {},
): Promise<string[]> {
  const out: string[] = []
  for (const file of files) {
    if (opts.isCancelled?.()) {
      out.forEach((u) => {
        if (u) URL.revokeObjectURL(u)
      })
      return []
    }
    try {
      assertPdfFile(file)
      const data = new Uint8Array(await file.arrayBuffer())
      const map = await renderPdfPageThumbs(data, {
        pageCount: 1,
        scale: opts.scale ?? 0.2,
        isCancelled: opts.isCancelled,
      })
      const url = map[0] ?? ''
      for (const [k, v] of Object.entries(map)) {
        if (Number(k) !== 0 && v) URL.revokeObjectURL(v)
      }
      out.push(url)
    } catch {
      out.push('')
    }
  }
  return out
}

export { pdfjs }
