import { getProject, type ProjectMeta } from '../registry'
import { FeatureLayout, ftPdfFaq, ftPdfInfoItems } from '../../components/FeatureLayout'
import { FtPdfFileMetrics, FtSection } from '../../components/FeatureToolUI'
import { ActionButton } from '../../components/ActionButton'
import { FileDrop } from '../../components/FileDrop'
import { PDF_ACCEPT, PDF_MAX_BYTES } from '../../lib/pdf'
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
  description: '將 PDF 頁面渲染成 PNG 並下載',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-to-image') ?? fallback
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
    if (f.size > PDF_MAX_BYTES) {
      setError(`檔案過大（上限 ${formatBytes(PDF_MAX_BYTES)}）`)
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
    <FeatureLayout
      meta={meta}
      actions={
        <ActionButton
          className="btn sm accent"
          icon="download"
          disabled={!file || busy}
          onClick={() => void downloadAll()}
        >
          {busy ? '處理中…' : '下載 ZIP'}
        </ActionButton>
      }
      toolbar={
        <FileDrop
          accept={PDF_ACCEPT}
          maxBytes={PDF_MAX_BYTES}
          disabled={busy}
          label="拖放 PDF 到此，或點擊選擇"
          hint={`上限 ${formatBytes(PDF_MAX_BYTES)} · 最多 ${MAX_PAGES} 頁 · 預覽前 5 頁`}
          onFiles={(files) => void onFile(files[0] ?? null)}
        />
      }
      infoItems={ftPdfInfoItems([{ label: '本工具頁數上限', value: `${MAX_PAGES} 頁` }])}
      faq={ftPdfFaq}
      footerHint="使用 pdf.js 本機渲染為 PNG。"
    >
      <div className="ft-pdf-stack">
        <FtPdfFileMetrics
          fileName={file?.name}
          sizeBytes={file?.size}
          pageCount={pageCount}
          extra={busy && progress ? [{ label: '狀態', value: progress }] : []}
        />
        {error && <p className="field-error">{error}</p>}
        {previews.length ? (
          previews.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`第 ${i + 1} 頁`}
              style={{ maxWidth: '100%', borderRadius: 12, border: '1px solid var(--line)' }}
            />
          ))
        ) : (
          <p className="muted">上傳 PDF 後可在此預覽前幾頁渲染結果。</p>
        )}
        {file && (
          <FtSection title="輸出設定" hint="變更倍率後請重新上傳以更新預覽；下載使用目前倍率。">
            <div className="stack">
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
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {busy && (
                  <ActionButton className="btn sm ghost" onClick={abort}>
                    取消
                  </ActionButton>
                )}
                <ActionButton
                  className="btn sm ghost"
                  icon="download"
                  disabled={!previews.length || busy}
                  onClick={() => void downloadFirst()}
                >
                  下載第 1 頁
                </ActionButton>
              </div>
            </div>
          </FtSection>
        )}
      </div>
    </FeatureLayout>
  )
}
