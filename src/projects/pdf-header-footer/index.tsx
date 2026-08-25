import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes, limitText, charCount } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-header-footer',
  title: 'PDF 頁首頁尾',
  description: '為每頁加上頁首與頁尾文字。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-header-footer') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80
const TEXT_MAX = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [header, setHeader] = useLocalStorage('lab:pdf-hf:header', 'Document')
  const [footer, setFooter] = useLocalStorage('lab:pdf-hf:footer', 'Confidential')
  const [size, setSize] = useLocalStorage('lab:pdf-hf:size', 10)

  async function onFile(f: File | null) {
    if (!f) return
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('請上傳 PDF 檔案')
      return
    }
    if (f.size > PDF_MAX) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX)}）`)
      return
    }
    setBusy(true)
    setError('')
    setProgress('讀取 PDF…')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${n} 頁）`)
        setFile(null)
        setPageCount(0)
        return
      }
      setPageCount(n)
      setFile(f)
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const pages = doc.getPages()
      if (pages.length > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁）`)
        return
      }
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const fontSize = clamp(size, 8, 24)
      const h = limitText(header, TEXT_MAX)
      const f = limitText(footer, TEXT_MAX)
      for (let i = 0; i < pages.length; i++) {
        setProgress(`處理第 ${i + 1}/${pages.length} 頁`)
        const page = pages[i]!
        const { width, height } = page.getSize()
        if (h) page.drawText(h, { x: 36, y: height - 28, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) })
        if (f) {
          const tw = font.widthOfTextAtSize(f, fontSize)
          page.drawText(f, { x: (width - tw) / 2, y: 20, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) })
        }
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-hf.pdf`,
      )
    } catch {
      setError('處理失敗（中文建議改用影像／HTML 轉 PDF）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        頁首／頁尾文字建議使用英數（標準字型）。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">上傳 PDF</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            disabled={busy}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="field-wrap">
          <label className="label">頁首</label>
          <input
            className="field"
            value={header}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setHeader(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(header)} / {TEXT_MAX}
            </span>
          </div>
        </div>
        <div className="field-wrap">
          <label className="label">頁尾</label>
          <input
            className="field"
            value={footer}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setFooter(limitText(e.target.value, TEXT_MAX))}
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(footer)} / {TEXT_MAX}
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
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
