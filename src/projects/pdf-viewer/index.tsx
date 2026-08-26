import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useEffect, useRef, useState } from 'react'
import { clamp, formatBytes } from '../../lib/utils'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-viewer',
  title: 'PDF 檢視器',
  description: '本機預覽 PDF 頁面。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-viewer') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80

export default function Page() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pdfRef = useRef<pdfjs.PDFDocumentProxy | null>(null)
  const renderId = useRef(0)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  async function render(pageNum: number, s: number) {
    const pdf = pdfRef.current
    const canvas = canvasRef.current
    if (!pdf || !canvas) return
    const id = ++renderId.current
    setProgress(`渲染第 ${pageNum} 頁…`)
    try {
      const p = await pdf.getPage(pageNum)
      if (id !== renderId.current) return
      const viewport = p.getViewport({ scale: clamp(s, 0.5, 3) })
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await p.render({ canvasContext: ctx, viewport }).promise
    } catch {
      if (id === renderId.current) setError('渲染失敗')
    } finally {
      if (id === renderId.current) setProgress('')
    }
  }

  useEffect(() => {
    if (pageCount) void render(page, scale)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale, pageCount])

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
    setProgress('載入 PDF…')
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        pdfRef.current = null
        setPageCount(0)
        return
      }
      pdfRef.current = pdf
      setPageCount(pdf.numPages)
      setPage(1)
      setFileName(f.name)
      setFileSize(f.size)
    } catch {
      setError('無法開啟 PDF（可能已加密或損毀）')
      pdfRef.current = null
      setPageCount(0)
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <ProjectShell meta={meta}>
      <p className="muted" style={{ marginBottom: 12 }}>
        檔案僅在瀏覽器開啟，不會上傳。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
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
        {fileName && (
          <p className="muted" style={{ margin: 0 }}>
            {fileName} · {pageCount} 頁 · {formatBytes(fileSize)}
            {busy || progress ? ` · ${progress || '載入中…'}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {pageCount > 0 && (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn sm ghost" disabled={page <= 1 || busy} onClick={() => setPage((p) => p - 1)}>
              上一頁
            </button>
            <span className="muted">
              {page} / {pageCount}
            </span>
            <button
              type="button"
              className="btn sm ghost"
              disabled={page >= pageCount || busy}
              onClick={() => setPage((p) => p + 1)}
            >
              下一頁
            </button>
            <label className="stack" style={{ minWidth: 160 }}>
              <span className="label">縮放 {scale.toFixed(1)}x</span>
              <input
                type="range"
                min={5}
                max={30}
                disabled={busy}
                value={Math.round(scale * 10)}
                onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 3))}
              />
            </label>
          </div>
        )}
        <div
          style={{
            overflow: 'auto',
            border: '1px solid var(--line)',
            borderRadius: 12,
            background: 'var(--bg-muted)',
            maxHeight: 720,
          }}
        >
          <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%' }} />
        </div>
      </div>
    </ProjectShell>
  )
}
