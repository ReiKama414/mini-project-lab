import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob, downloadCanvas } from '../../lib/imageCanvas'
import * as pdfjs from 'pdfjs-dist'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-to-image',
  title: 'PDF 轉圖片',
  description: '將 PDF 頁面渲染成 PNG 並下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-to-image') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 40

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [previews, setPreviews] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [scale, setScale] = useLocalStorage('lab:pdf-to-image:scale', 1.5)
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
    setPreviews([])
    setProgress('讀取 PDF…')
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      if (id !== runId.current) return
      const pdf = await pdfjs.getDocument({ data }).promise
      if (id !== runId.current) return
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        setFile(null)
        setPageCount(0)
        return
      }
      setPageCount(pdf.numPages)
      setFile(f)
      const urls: string[] = []
      const s = clamp(scale, 0.5, 3)
      const maxPreview = Math.min(pdf.numPages, 5)
      for (let i = 1; i <= maxPreview; i++) {
        if (id !== runId.current) return
        setProgress(`預覽第 ${i}/${maxPreview} 頁`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: Math.min(s, 1.2) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        if (id !== runId.current) return
        urls.push(canvas.toDataURL('image/png'))
      }
      if (id !== runId.current) return
      setPreviews(urls)
    } catch {
      if (id === runId.current) setError('無法渲染 PDF（可能已加密或損毀）')
    } finally {
      if (id === runId.current) {
        setBusy(false)
        setProgress('')
      }
    }
  }

  async function downloadAll() {
    if (!file) return
    const id = ++runId.current
    setBusy(true)
    setError('')
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      if (id !== runId.current) return
      const pdf = await pdfjs.getDocument({ data }).promise
      if (id !== runId.current) return
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        return
      }
      const zip = new JSZip()
      const s = clamp(scale, 0.5, 3)
      for (let i = 1; i <= pdf.numPages; i++) {
        if (id !== runId.current) return
        setProgress(`匯出第 ${i}/${pdf.numPages} 頁`)
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: s })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: ctx, viewport }).promise
        if (id !== runId.current) return
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (blob) zip.file(`page-${String(i).padStart(3, '0')}.png`, blob)
      }
      if (id !== runId.current) return
      setProgress('打包 ZIP…')
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-pages.zip')
    } catch {
      if (id === runId.current) setError('匯出失敗')
    } finally {
      if (id === runId.current) {
        setBusy(false)
        setProgress('')
      }
    }
  }

  async function downloadFirst() {
    if (!previews[0]) return
    const img = new Image()
    img.src = previews[0]
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    downloadCanvas(c, 'page-001.png')
  }

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void downloadAll()}>
          {busy ? '處理中…' : '下載全部 ZIP'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        使用 pdf.js 本機渲染。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁；預覽最多前 5 頁。
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
          <span className="label">解析度倍率 {scale.toFixed(1)}x</span>
          <input
            type="range"
            min={5}
            max={30}
            disabled={busy}
            value={Math.round(scale * 10)}
            onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 3))}
          />
        </label>
        <p className="field-hint">變更倍率後請重新上傳以更新預覽；下載會使用目前倍率。</p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {busy && (
            <button type="button" className="btn sm ghost" onClick={abort}>
              取消
            </button>
          )}
          <button type="button" className="btn ghost" disabled={!previews.length || busy} onClick={() => void downloadFirst()}>
            下載第 1 頁
          </button>
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void downloadAll()}>
            {busy ? progress || '處理中…' : '下載全部 PNG ZIP'}
          </button>
        </div>
        <div className="stack">
          {previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`第 ${i + 1} 頁`}
              style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }}
            />
          ))}
        </div>
      </div>
    </ProjectShell>
  )
}
