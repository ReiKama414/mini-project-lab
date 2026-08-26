import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-page-number',
  title: 'PDF 頁碼',
  description: '為每一頁加上頁碼。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-page-number') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80

type Pos = 'bottom-center' | 'bottom-right' | 'top-center'

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [pos, setPos] = useLocalStorage<Pos>('lab:pdf-page-number:pos', 'bottom-center')
  const [start, setStart] = useLocalStorage('lab:pdf-page-number:start', 1)
  const [size, setSize] = useLocalStorage('lab:pdf-page-number:size', 12)

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
      const fontSize = clamp(size, 8, 36)
      const base = clamp(start, 1, 9999)
      for (let i = 0; i < pages.length; i++) {
        setProgress(`頁碼第 ${i + 1}/${pages.length} 頁`)
        const page = pages[i]!
        const label = String(base + i)
        const { width, height } = page.getSize()
        const tw = font.widthOfTextAtSize(label, fontSize)
        let x = (width - tw) / 2
        let y = 24
        if (pos === 'bottom-right') {
          x = width - tw - 24
          y = 24
        }
        if (pos === 'top-center') {
          x = (width - tw) / 2
          y = height - 36
        }
        page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.2, 0.2, 0.2) })
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-pages.pdf`,
      )
    } catch {
      setError('加上頁碼失敗')
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
        本機為每頁加上數字頁碼。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <FileDrop
          accept="application/pdf"
          maxBytes={PDF_MAX}
          disabled={busy}
          label="拖放 PDF 到此，或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX)}`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · {pageCount} 頁 · {formatBytes(file.size)}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {(
            [
              ['bottom-center', '底部置中'],
              ['bottom-right', '底部右側'],
              ['top-center', '頂部置中'],
            ] as [Pos, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`btn sm ${pos === id ? 'accent' : 'ghost'}`}
              disabled={busy}
              onClick={() => setPos(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="stack">
          <span className="label">起始頁碼</span>
          <input
            className="field"
            type="number"
            min={1}
            max={9999}
            disabled={busy}
            value={start}
            onChange={(e) => setStart(clamp(Number(e.target.value) || 1, 1, 9999))}
          />
        </label>
        <label className="stack">
          <span className="label">字級 {size}</span>
          <input
            type="range"
            min={8}
            max={36}
            disabled={busy}
            value={size}
            onChange={(e) => setSize(clamp(Number(e.target.value), 8, 36))}
          />
        </label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
