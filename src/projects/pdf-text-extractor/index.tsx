import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useRef, useState } from 'react'
import { formatBytes, copyText, downloadText, limitText, charCount } from '../../lib/utils'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-text-extractor',
  title: 'PDF 文字擷取',
  description: '從 PDF 擷取可選文字。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-text-extractor') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80
const TEXT_MAX = 200000

export default function Page() {
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [pageCount, setPageCount] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const runId = useRef(0)

  function abort() {
    runId.current += 1
    setBusy(false)
    setProgress('')
  }

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
    const id = ++runId.current
    setBusy(true)
    setError('')
    setText('')
    setProgress('讀取 PDF…')
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      if (id !== runId.current) return
      const pdf = await pdfjs.getDocument({ data }).promise
      if (id !== runId.current) return
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        return
      }
      setPageCount(pdf.numPages)
      const parts: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        if (id !== runId.current) return
        setProgress(`擷取第 ${i}/${pdf.numPages} 頁`)
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const line = content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
        parts.push(`--- 第 ${i} 頁 ---\n${line}`)
      }
      if (id !== runId.current) return
      setText(limitText(parts.join('\n\n'), TEXT_MAX))
      setFileName(f.name)
    } catch {
      if (id === runId.current) setError('擷取失敗（可能為掃描影像 PDF 或已加密）')
    } finally {
      if (id === runId.current) {
        setBusy(false)
        setProgress('')
      }
    }
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <div className="row">
          <button type="button" className="btn sm ghost" disabled={!text || busy} onClick={() => void copyText(text)}>
            複製
          </button>
          <button
            type="button"
            className="btn sm accent"
            disabled={!text || busy}
            onClick={() => downloadText((fileName.replace(/\.pdf$/i, '') || 'pdf') + '-text.txt', text)}
          >
            下載 TXT
          </button>
        </div>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        僅擷取內嵌文字層；掃描檔需先 OCR。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
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
        {fileName && (
          <p className="muted" style={{ margin: 0 }}>
            {fileName} · {pageCount} 頁
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {busy && (
          <button type="button" className="btn sm ghost" onClick={abort}>
            取消
          </button>
        )}
        <div className="field-wrap">
          <label className="label">文字內容</label>
          <textarea
            className="field"
            rows={16}
            value={text}
            maxLength={TEXT_MAX}
            disabled={busy}
            onChange={(e) => setText(limitText(e.target.value, TEXT_MAX))}
            placeholder="上傳後顯示…"
          />
          <div className="field-meta">
            <span> </span>
            <span>
              {charCount(text)} / {TEXT_MAX}
            </span>
          </div>
        </div>
      </div>
    </ProjectShell>
  )
}
