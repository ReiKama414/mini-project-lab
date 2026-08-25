import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-merge',
  title: 'PDF 合併',
  description: '將多個 PDF 合併成單一檔案。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-merge') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_FILES = 20
const MAX_TOTAL_PAGES = 80

export default function Page() {
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  function onFiles(list: FileList | null) {
    if (!list) return
    const arr = Array.from(list).slice(0, MAX_FILES)
    for (const f of arr) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        setError('請上傳 PDF 檔案')
        return
      }
      if (f.size > PDF_MAX) {
        setError(`「${f.name}」過大（上限 ${formatBytes(PDF_MAX)}）`)
        return
      }
    }
    setError('')
    setFiles(arr)
  }

  function move(i: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  function removeAt(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function merge() {
    if (files.length < 2) {
      setError('請至少選擇 2 個 PDF')
      return
    }
    setBusy(true)
    setError('')
    setProgress('')
    try {
      const out = await PDFDocument.create()
      let totalPages = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]!
        setProgress(`合併第 ${i + 1}/${files.length} 個檔案`)
        const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
        const n = doc.getPageCount()
        totalPages += n
        if (totalPages > MAX_TOTAL_PAGES) {
          setError(`合併後頁數過多（上限 ${MAX_TOTAL_PAGES} 頁）`)
          return
        }
        const pages = await out.copyPages(doc, doc.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      setProgress('寫入檔案…')
      const bytes = await out.save()
      downloadBlob(new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }), 'merged.pdf')
    } catch {
      setError('合併失敗（可能含加密或損毀檔）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>
          {busy ? '合併中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機合併，單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_FILES} 個、合併後最多 {MAX_TOTAL_PAGES} 頁。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">選擇 PDF（可多選）</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            multiple
            disabled={busy}
            onChange={(e) => onFiles(e.target.files)}
          />
        </label>
        {error && <p className="field-error">{error}</p>}
        {busy && progress && <p className="field-hint">{progress}</p>}
        {files.map((f, i) => (
          <div key={f.name + i} className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13 }}>
              {i + 1}. {f.name} · {formatBytes(f.size)}
            </span>
            <div className="row">
              <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={busy || i === 0}>
                上移
              </button>
              <button
                type="button"
                className="btn sm ghost"
                onClick={() => move(i, 1)}
                disabled={busy || i === files.length - 1}
              >
                下移
              </button>
              <button type="button" className="btn sm ghost" onClick={() => removeAt(i)} disabled={busy}>
                移除
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={files.length < 2 || busy} onClick={() => void merge()}>
          {busy ? progress || '合併中…' : '合併並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
