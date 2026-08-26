import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useState } from 'react'
import { formatBytes, limitText, charCount, copyText } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'

const fallback: ProjectMeta = {
  slug: 'pdf-metadata',
  title: 'PDF 中繼資料',
  description: '檢視與編輯 PDF 標題／作者等資訊。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-metadata') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const F_MAX = 120

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [subject, setSubject] = useState('')
  const [keywords, setKeywords] = useState('')
  const [creator, setCreator] = useState('')
  const [pageCount, setPageCount] = useState(0)
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
    setProgress('讀取中繼資料…')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer(), { ignoreEncryption: true })
      setPageCount(doc.getPageCount())
      setTitle(limitText(doc.getTitle() ?? '', F_MAX))
      setAuthor(limitText(doc.getAuthor() ?? '', F_MAX))
      setSubject(limitText(doc.getSubject() ?? '', F_MAX))
      {
        const kw = doc.getKeywords()
        const kwText = Array.isArray(kw) ? kw.join(', ') : typeof kw === 'string' ? kw : ''
        setKeywords(limitText(kwText, F_MAX))
      }
      setCreator(limitText(doc.getCreator() ?? '', F_MAX))
      setFile(f)
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
      setFile(null)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  async function run() {
    if (!file) return
    setBusy(true)
    setError('')
    setProgress('寫入中繼資料…')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      doc.setTitle(limitText(title, F_MAX))
      doc.setAuthor(limitText(author, F_MAX))
      doc.setSubject(limitText(subject, F_MAX))
      doc.setKeywords(
        limitText(keywords, F_MAX)
          .split(/[,，]/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
      doc.setCreator(limitText(creator, F_MAX))
      doc.setModificationDate(new Date())
      downloadBlob(
        new Blob([Uint8Array.from(await doc.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-meta.pdf`,
      )
    } catch {
      setError('寫入失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const summary = JSON.stringify({ title, author, subject, keywords, creator, pageCount }, null, 2)

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!file || busy} onClick={() => void copyText(summary)}>
            複製 JSON
          </button>
          <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>
            下載
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機讀寫 PDF Info 字典。單檔上限 {formatBytes(PDF_MAX)}。
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
        {(
          [
            ['標題', title, setTitle],
            ['作者', author, setAuthor],
            ['主旨', subject, setSubject],
            ['關鍵字', keywords, setKeywords],
            ['建立者', creator, setCreator],
          ] as const
        ).map(([label, value, setter]) => (
          <div key={label} className="field-wrap">
            <label className="label">{label}</label>
            <input
              className="field"
              value={value}
              maxLength={F_MAX}
              disabled={busy}
              onChange={(e) => setter(limitText(e.target.value, F_MAX))}
            />
            <div className="field-meta">
              <span> </span>
              <span>
                {charCount(value)} / {F_MAX}
              </span>
            </div>
          </div>
        ))}
        <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? progress || '處理中…' : '儲存中繼資料並下載'}
        </button>
      </div>
    </ProjectShell>
  )
}
