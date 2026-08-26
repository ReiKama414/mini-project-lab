import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-delete-pages',
  title: 'PDF 刪除頁面',
  description: '刪除指定頁碼後下載新 PDF。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-delete-pages') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [del, setDel] = useState('1')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

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
    setProgress('處理中…')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = src.getPageCount()
      const remove = new Set(
        del
          .split(/[,，\s]+/)
          .map((s) => clamp(Number(s), 1, n) - 1)
          .filter((i) => !Number.isNaN(i) && i >= 0),
      )
      if (!remove.size) {
        setError('請指定要刪除的頁碼')
        return
      }
      if (remove.size >= n) {
        setError('不能刪除全部頁面')
        return
      }
      setProgress('產生新 PDF…')
      const keep = src.getPageIndices().filter((i) => !remove.has(i))
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, keep)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(
        new Blob([Uint8Array.from(await out.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-trimmed.pdf`,
      )
    } catch {
      setError('處理失敗')
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
        本機刪除指定頁，其餘頁保留。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
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
        <label className="stack">
          <span className="label">要刪除的頁碼</span>
          <input
            className="field"
            value={del}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setDel(limitText(e.target.value, 120))}
            placeholder="例：2,4,7"
          />
        </label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '刪除並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
