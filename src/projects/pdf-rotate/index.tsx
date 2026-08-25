import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { clamp, formatBytes, limitText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument, degrees } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-rotate',
  title: 'PDF 旋轉',
  description: '旋轉指定頁或全部頁面。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-rotate') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [angle, setAngle] = useState<90 | 180 | 270>(90)
  const [pages, setPages] = useState('all')
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
    setProgress('旋轉頁面…')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const n = doc.getPageCount()
      const indices =
        pages.trim().toLowerCase() === 'all'
          ? doc.getPageIndices()
          : [
              ...new Set(
                pages
                  .split(/[,，\s]+/)
                  .map((s) => clamp(Number(s), 1, n) - 1)
                  .filter((i) => i >= 0 && !Number.isNaN(i)),
              ),
            ]
      if (!indices.length) {
        setError('請指定有效頁碼，或輸入 all')
        return
      }
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k]!
        setProgress(`旋轉第 ${k + 1}/${indices.length} 頁`)
        const page = doc.getPage(i)
        const cur = page.getRotation().angle
        page.setRotation(degrees((cur + angle) % 360))
      }
      setProgress('寫入檔案…')
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-rotated.pdf`,
      )
    } catch {
      setError('旋轉失敗')
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
        本機旋轉 PDF 頁面。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
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
        <div className="row">
          {([90, 180, 270] as const).map((a) => (
            <button
              key={a}
              type="button"
              className={`btn sm ${angle === a ? 'accent' : 'ghost'}`}
              disabled={busy}
              onClick={() => setAngle(a)}
            >
              旋轉 {a}°
            </button>
          ))}
        </div>
        <label className="stack">
          <span className="label">頁碼（all 或 1,3,5）</span>
          <input
            className="field"
            value={pages}
            maxLength={120}
            disabled={busy}
            onChange={(e) => setPages(limitText(e.target.value, 120))}
          />
        </label>
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '套用並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
