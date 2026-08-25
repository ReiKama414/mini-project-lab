import { getProject, type ProjectMeta } from '../registry'
import { ProjectShell } from '../../components/ProjectShell'
import { useEffect, useRef, useState } from 'react'
import { formatBytes } from '../../lib/utils'
import { downloadBlob } from '../../lib/imageCanvas'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const fallback: ProjectMeta = {
  slug: 'pdf-organizer',
  title: 'PDF 頁面整理',
  description: '重新排序 PDF 頁面後下載。',
  tier: 'feature',
  effort: '1～3 天',
  tags: ['utility'],
}
const meta = getProject('pdf-organizer') ?? fallback
const PDF_MAX = 25 * 1024 * 1024
const MAX_PAGES = 80
const THUMB_SCALE = 0.25

export default function Page() {
  const [file, setFile] = useState<File | null>(null)
  const [order, setOrder] = useState<number[]>([])
  const [thumbs, setThumbs] = useState<Record<number, string>>({})
  const [pageCount, setPageCount] = useState(0)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingThumbs, setLoadingThumbs] = useState(false)
  const runId = useRef(0)
  const thumbsRef = useRef<Record<number, string>>({})

  useEffect(() => {
    thumbsRef.current = thumbs
  }, [thumbs])

  useEffect(() => {
    return () => {
      runId.current += 1
      Object.values(thumbsRef.current).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  function clearThumbs() {
    Object.values(thumbsRef.current).forEach((url) => URL.revokeObjectURL(url))
    setThumbs({})
  }

  async function loadThumbs(data: Uint8Array, n: number, id: number) {
    setLoadingThumbs(true)
    setProgress('')
    const next: Record<number, string> = {}
    try {
      const pdf = await pdfjs.getDocument({ data }).promise
      if (id !== runId.current) return
      for (let p = 1; p <= n; p++) {
        if (id !== runId.current) {
          Object.values(next).forEach((url) => URL.revokeObjectURL(url))
          return
        }
        setProgress(`載入縮圖第 ${p}/${n} 頁`)
        try {
          const page = await pdf.getPage(p)
          const viewport = page.getViewport({ scale: THUMB_SCALE })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          await page.render({ canvasContext: ctx, viewport }).promise
          if (id !== runId.current) {
            Object.values(next).forEach((url) => URL.revokeObjectURL(url))
            return
          }
          const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
          if (blob) next[p - 1] = URL.createObjectURL(blob)
        } catch {
          /* skip failed page thumb */
        }
      }
      if (id !== runId.current) {
        Object.values(next).forEach((url) => URL.revokeObjectURL(url))
        return
      }
      clearThumbs()
      setThumbs(next)
    } catch {
      if (id === runId.current) setError('縮圖載入失敗（仍可依頁碼排序後匯出）')
    } finally {
      if (id === runId.current) {
        setLoadingThumbs(false)
        setProgress('')
      }
    }
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
    setProgress('')
    clearThumbs()
    setOrder([])
    setFile(null)
    setPageCount(0)
    try {
      const buf = await f.arrayBuffer()
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true })
      const n = doc.getPageCount()
      if (n > MAX_PAGES) {
        setError(`頁數過多（上限 ${MAX_PAGES} 頁，目前 ${n} 頁）`)
        return
      }
      if (n < 1) {
        setError('此 PDF 沒有頁面')
        return
      }
      setOrder(Array.from({ length: n }, (_, i) => i))
      setFile(f)
      setPageCount(n)
      setBusy(false)
      await loadThumbs(new Uint8Array(buf.slice(0)), n, id)
    } catch {
      if (id === runId.current) setError('無法讀取 PDF（可能已加密或損毀）')
    } finally {
      if (id === runId.current) setBusy(false)
    }
  }

  function move(i: number, dir: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })
  }

  function removeAt(i: number) {
    setOrder((prev) => {
      if (prev.length <= 1) {
        setError('至少需保留一頁')
        return prev
      }
      setError('')
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function run() {
    if (!file || !order.length) return
    setBusy(true)
    setError('')
    setProgress('正在產生 PDF…')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true })
      const out = await PDFDocument.create()
      const pages = await out.copyPages(src, order)
      pages.forEach((p) => out.addPage(p))
      downloadBlob(
        new Blob([Uint8Array.from(await out.save())], { type: 'application/pdf' }),
        `${file.name.replace(/\.pdf$/i, '')}-organized.pdf`,
      )
    } catch {
      setError('整理失敗')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  const actionsDisabled = !file || busy || loadingThumbs || !order.length

  return (
    <ProjectShell
      meta={meta}
      actions={
        <button type="button" className="btn sm accent" disabled={actionsDisabled} onClick={() => void run()}>
          下載
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 12 }}>
        本機預覽縮圖後可上移／下移／刪除／反轉頁序。單檔上限 {formatBytes(PDF_MAX)}，最多 {MAX_PAGES} 頁。
      </p>
      <div className="panel stack">
        <label className="stack">
          <span className="label">上傳 PDF</span>
          <input
            className="field"
            type="file"
            accept="application/pdf"
            disabled={busy || loadingThumbs}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <p className="muted" style={{ margin: 0 }}>
            {file.name} · 原 {pageCount} 頁 · 目前保留 {order.length} 頁
            {loadingThumbs && progress ? ` · ${progress}` : ''}
            {busy && progress ? ` · ${progress}` : ''}
          </p>
        )}
        {error && <p className="field-error">{error}</p>}
        {loadingThumbs && <p className="field-hint">{progress || '載入縮圖中…'}</p>}
        <div className="stack" style={{ maxHeight: 480, overflow: 'auto', gap: 10 }}>
          {order.map((pageIndex, i) => (
            <div
              key={`${pageIndex}-${i}`}
              className="row"
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '8px 0',
                borderBottom: '1px solid var(--line)',
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: 'center', minWidth: 0 }}>
                {thumbs[pageIndex] ? (
                  <img
                    src={thumbs[pageIndex]}
                    alt={`第 ${pageIndex + 1} 頁`}
                    style={{
                      width: 56,
                      height: 72,
                      objectFit: 'contain',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      background: '#fff',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 56,
                      height: 72,
                      border: '1px dashed var(--line)',
                      borderRadius: 6,
                      flexShrink: 0,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    {loadingThumbs ? '…' : pageIndex + 1}
                  </div>
                )}
                <span style={{ fontSize: 13 }}>
                  位置 {i + 1} ← 原第 {pageIndex + 1} 頁
                </span>
              </div>
              <div className="row" style={{ flexShrink: 0 }}>
                <button type="button" className="btn sm ghost" onClick={() => move(i, -1)} disabled={i === 0 || busy}>
                  上移
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1 || busy}
                >
                  下移
                </button>
                <button type="button" className="btn sm ghost" onClick={() => removeAt(i)} disabled={busy || order.length <= 1}>
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn sm ghost"
            disabled={!order.length || busy}
            onClick={() => setOrder((o) => [...o].reverse())}
          >
            整份反轉
          </button>
          <button type="button" className="btn accent" disabled={actionsDisabled} onClick={() => void run()}>
            {busy ? progress || '處理中…' : '套用並下載'}
          </button>
        </div>
      </div>
    </ProjectShell>
  )
}
