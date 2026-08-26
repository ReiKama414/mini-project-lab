import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { FileDrop } from '../../components/FileDrop'
import { useRef, useState } from 'react'
import { useLocalStorage } from '../../lib/storage'
import { clamp, formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-compressor',
  title: 'PDF 壓縮',
  description: '將頁面柵格化後以 JPG 重建以縮小體積。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-compressor') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 40

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [origSize, setOrigSize] = useState(0)
  const [outSize, setOutSize] = useState(0)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [quality, setQuality] = useLocalStorage('lab:pdf-compressor:q', 0.7)
  const [scale, setScale] = useLocalStorage('lab:pdf-compressor:scale', 1.2)
  const runId = useRef(0)

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
    runId.current += 1
    setBusy(true)
    setError('')
    setProgress('讀取 PDF…')
    setOutSize(0)
    setFile(null)
    setPageCount(0)
    setOrigSize(0)
    try {
      const data = new Uint8Array(await f.arrayBuffer())
      const pdf = await pdfjs.getDocument({ data }).promise
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        return
      }
      setFile(f)
      setOrigSize(f.size)
      setPageCount(pdf.numPages)
    } catch {
      setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  function abort() {
    runId.current += 1
    setBusy(false)
    setProgress('')
  }

  async function run() {
    if (!file) return
    const id = ++runId.current
    setBusy(true)
    setError('')
    setOutSize(0)
    setProgress('')
    try {
      const data = new Uint8Array(await file.arrayBuffer())
      if (id !== runId.current) return
      const pdf = await pdfjs.getDocument({ data }).promise
      if (id !== runId.current) return
      if (pdf.numPages > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${pdf.numPages} 頁）`)
        return
      }
      setPageCount(pdf.numPages)
      const out = await PDFDocument.create()
      const q = clamp(quality, 0.3, 0.92)
      const s = clamp(scale, 0.5, 2)
      for (let i = 1; i <= pdf.numPages; i++) {
        if (id !== runId.current) return
        setProgress(`壓縮第 ${i}/${pdf.numPages} 頁`)
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
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q))
        if (!blob) continue
        const jpg = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()))
        const p = out.addPage([jpg.width, jpg.height])
        p.drawImage(jpg, { x: 0, y: 0, width: jpg.width, height: jpg.height })
      }
      if (id !== runId.current) return
      if (out.getPageCount() < 1) {
        setError('壓縮失敗：未產生任何頁面')
        return
      }
      setProgress('寫入檔案…')
      const bytes = await out.save()
      if (id !== runId.current) return
      setOutSize(bytes.byteLength)
      downloadBlob(
        new Blob([Uint8Array.from(bytes)], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`,
      )
    } catch {
      if (id === runId.current) setError('壓縮失敗，請確認檔案為有效 PDF')
    } finally {
      if (id === runId.current) {
        setBusy(false)
        setProgress('')
      }
    }
  }

  const ratio =
    origSize > 0 && outSize > 0 ? Math.round((outSize / origSize) * 100) : null

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={!file || busy} onClick={() => void run()}>
          {busy ? '壓縮中…' : '下載'}
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        以頁面點陣化方式壓縮。文字與向量會變成圖片，無法再選取文字。單檔上限 {formatBytes(PDF_MAX)}，最多{' '}
        {MAX_PAGES} 頁。
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
            {file.name} · {pageCount} 頁
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {(origSize > 0 || outSize > 0) && (
          <p className="field-hint" style={{ margin: 0 }}>
            壓縮前：{formatBytes(origSize)}
            {outSize > 0 ? (
              <>
                {' '}
                → 壓縮後：{formatBytes(outSize)}
                {ratio != null ? `（約為原本的 ${ratio}%）` : ''}
              </>
            ) : (
              ' → 壓縮後：尚未產生'
            )}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        <p className="field-hint">注意：壓縮後每頁為 JPG 影像，文字不可搜尋／複製，且可能有損畫質。</p>
        <label className="stack">
          <span className="label">JPG 品質 {Math.round(quality * 100)}%</span>
          <input
            type="range"
            min={30}
            max={92}
            disabled={busy}
            value={Math.round(quality * 100)}
            onChange={(e) => setQuality(clamp(Number(e.target.value) / 100, 0.3, 0.92))}
          />
        </label>
        <label className="stack">
          <span className="label">渲染倍率 {scale.toFixed(1)}x</span>
          <input
            type="range"
            min={5}
            max={20}
            disabled={busy}
            value={Math.round(scale * 10)}
            onChange={(e) => setScale(clamp(Number(e.target.value) / 10, 0.5, 2))}
          />
        </label>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {busy && (
            <button type="button" className="btn sm ghost" onClick={abort}>
              取消
            </button>
          )}
          <button type="button" className="btn accent" disabled={!file || busy} onClick={() => void run()}>
            {busy ? progress || '壓縮中…' : '壓縮並下載'}
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
