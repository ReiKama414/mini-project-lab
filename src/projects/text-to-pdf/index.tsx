import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, limitText, charCount, isNonEmpty } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'text-to-pdf',
  title: '文字轉 PDF',
  description: '將純文字匯出為 PDF（支援中文點陣）。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('text-to-pdf') ?? fallback
const TEXT_MAX = 20000
const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 48
const MAX_PAGES = 40

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para) {
      lines.push('')
      continue
    }
    let line = ''
    for (const ch of [...para]) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = ch
      } else line = test
    }
    if (line) lines.push(line)
  }
  return lines
}

export default function Page() {
  const [text, setText] = useLocalStorage(
    'lab:text-to-pdf:text',
    'Hello PDF\n\n這是本機文字轉 PDF 示範（支援中文）。',
  )
  const [size, setSize] = useLocalStorage('lab:text-to-pdf:size', 12)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState('')
  const [pageHint, setPageHint] = useState('')

  async function run() {
    if (!isNonEmpty(text)) {
      setError('請輸入文字')
      return
    }
    setBusy(true)
    setError('')
    setProgress('排版中…')
    setPageHint('')
    try {
      const fontSize = clamp(size, 8, 24)
      const lineHeight = fontSize * 1.5
      const contentH = PAGE_H - MARGIN * 2
      const maxWidth = PAGE_W - MARGIN * 2

      const measure = document.createElement('canvas')
      const mctx = measure.getContext('2d')!
      mctx.font = `${fontSize}px "Noto Sans TC","Microsoft JhengHei",sans-serif`
      const lines = wrapLines(mctx, limitText(text, TEXT_MAX), maxWidth)
      const linesPerPage = Math.max(1, Math.floor(contentH / lineHeight))
      const pageCount = Math.min(MAX_PAGES, Math.max(1, Math.ceil(lines.length / linesPerPage)))
      if (Math.ceil(lines.length / linesPerPage) > MAX_PAGES) {
        setError(`內容過長（上限約 ${MAX_PAGES} 頁），請縮短文字`)
        return
      }

      const pdf = await PDFDocument.create()
      for (let p = 0; p < pageCount; p++) {
        setProgress(`產生第 ${p + 1}/${pageCount} 頁`)
        const canvas = document.createElement('canvas')
        canvas.width = PAGE_W
        canvas.height = PAGE_H
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, PAGE_W, PAGE_H)
        ctx.fillStyle = '#111'
        ctx.font = `${fontSize}px "Noto Sans TC","Microsoft JhengHei",sans-serif`
        ctx.textBaseline = 'top'
        const slice = lines.slice(p * linesPerPage, (p + 1) * linesPerPage)
        slice.forEach((line, i) => {
          ctx.fillText(line, MARGIN, MARGIN + i * lineHeight)
        })
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.92))
        if (!blob) continue
        const jpg = await pdf.embedJpg(new Uint8Array(await blob.arrayBuffer()))
        const page = pdf.addPage([PAGE_W, PAGE_H])
        page.drawImage(jpg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H })
      }
      if (pdf.getPageCount() < 1) {
        setError('產生失敗')
        return
      }
      setPageHint(`已匯出 ${pdf.getPageCount()} 頁`)
      downloadBlob(new Blob([Uint8Array.from(await pdf.save())], { type: 'application/pdf' }), 'text.pdf')
    } catch {
      setError('產生失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!isNonEmpty(text) || busy} onClick={() => void run()}>
          下載 PDF
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        以本機點陣繪製文字後嵌入 PDF（支援中文）。最多約 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        {error && <p className="field-error">{error}</p>}
        {pageHint && <p className="field-hint">{pageHint}</p>}
        <div className="field-wrap">
          <label className="label">文字內容</label>
          <textarea
            className={`field${!isNonEmpty(text) ? ' is-invalid' : ''}`}
            rows={14}
            value={text}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(text)} / {TEXT_MAX}
            </span>
          </div>
        </div>
        <label className="stack">
          <span className="label">字級 {size}</span>
          <input
            type="range"
            min={8}
            max={24}
            disabled={busy}
            value={size}
            onChange={(e) => setSize(clamp(Number(e.target.value), 8, 24))}
          />
        </label>
        <button type="button" className="btn accent" disabled={!isNonEmpty(text) || busy} onClick={() => void run()}>
          {busy ? progress || '產生中…' : '產生 PDF'}
        </button>
      </div>
    </ProjectShell>
  )
}
